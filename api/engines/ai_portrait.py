"""
ai_portrait.py — Vẽ chân dung bằng AI: Gemini -> MeToken -> Pollinations.

Pipeline (giữ đúng thứ tự trong docs/KIEN_TRUC.md §7):
    spec.prompt (offline, do Character Engine sinh)
        -> DeepSeek viết lại thành prompt ảnh tiếng Anh chi tiết  (nếu có DEEPSEEK_API_KEY)
        -> Gemini (có key) -> MeToken (có key) -> Pollinations (mặc định, không cần key)

Provider nào lỗi thì ghi lại rồi thử provider kế; hết provider mới ném
`AiPortraitError` kèm danh sách lỗi để người dùng biết chính xác cần sửa gì.
Ảnh trả về dạng `imageBase64` (web tự dựng `data:` URL) hoặc `imageUrl`.
"""

from __future__ import annotations

import base64
import hashlib
import urllib.parse
from typing import Any, Callable

import httpx

try:                                            # chạy: uvicorn main:app (cwd = api/)
    from config import Settings, settings
    from engines.llm import llm
except ModuleNotFoundError:                     # chạy kiểu gói: api.main
    from ..config import Settings, settings     # type: ignore[no-redef]
    from .llm import llm                        # type: ignore[no-redef]


class AiPortraitError(RuntimeError):
    """Lỗi vẽ ảnh AI — thông báo tiếng Việt hiển thị thẳng qua toast."""


DEFAULT_SIZE = 1024
FALLBACK_PROMPT = (
    "Full body character sheet portrait of {name}, {job}, {age} years old, "
    "neutral studio background, soft even lighting, front view, no text"
)


def seed_int(spec: dict) -> int:
    """Seed số nguyên (tất định theo nhân vật) để ảnh lặp lại được."""
    key = str(spec.get("seed") or spec.get("id") or "nhan-vat")
    return int(hashlib.sha1(key.encode("utf-8")).hexdigest()[:8], 16)


def build_prompt(
    spec: dict, *, style: str | None = None, use_llm: bool = True, cfg: Settings | None = None
) -> tuple[str, str]:
    """Trả `(prompt, nguồn)` — nguồn là `deepseek` | `character-engine` | `fallback`."""
    cfg = cfg or settings
    if use_llm and cfg.llm_ready:
        refined = llm.refine_image_prompt(spec, style=style)
        if refined:
            return refined, "deepseek"
    base = str(spec.get("prompt") or "").strip()
    if base:
        return base, "character-engine"
    identity = spec.get("identity") or {}
    return (
        FALLBACK_PROMPT.format(
            name=identity.get("fullName") or "a person",
            job=identity.get("occupationLabel") or "a character",
            age=identity.get("age") or 28,
        ),
        "fallback",
    )


def info(cfg: Settings | None = None) -> dict[str, Any]:
    """Tình trạng từng provider để `/api/engines` báo cho web."""
    cfg = cfg or settings
    return {
        "order": cfg.ai_providers(),
        "gemini": {"ready": bool(cfg.gemini_api_key), "model": cfg.gemini_image_model},
        "metoken": {"ready": bool(cfg.metoken_api_key), "model": cfg.metoken_image_model},
        "pollinations": {
            "ready": cfg.portrait_allow_pollinations,
            "note": "không cần key, chậm hơn và chất lượng thấp hơn",
        },
        "promptRefiner": "deepseek" if cfg.llm_ready else "character-engine (offline)",
    }


def generate(
    spec: dict,
    *,
    style: str | None = None,
    size: int = DEFAULT_SIZE,
    use_llm: bool = True,
    prompt_override: str | None = None,
    cfg: Settings | None = None,
) -> dict[str, Any]:
    """Vẽ 1 ảnh và trả dict gọn cho web: `{ provider, prompt, imageBase64|imageUrl, mimeType }`."""
    cfg = cfg or settings
    if prompt_override:
        prompt, source = str(prompt_override).strip(), "client"
    else:
        prompt, source = build_prompt(spec, style=style, use_llm=use_llm, cfg=cfg)

    providers = cfg.ai_providers()
    if not providers:
        raise AiPortraitError(
            "Chưa bật provider vẽ ảnh nào. Đặt GEMINI_API_KEY hoặc METOKEN_API_KEY trong .env, "
            "hoặc bật PORTRAIT_ALLOW_POLLINATIONS=true (miễn phí, không cần key)."
        )

    handlers: dict[str, Callable[..., dict[str, str]]] = {
        "gemini": _gemini,
        "metoken": _metoken,
        "pollinations": _pollinations,
    }
    failures: list[str] = []
    for name in providers:
        try:
            result = handlers[name](cfg, prompt, size=size, spec=spec)
        except (AiPortraitError, httpx.HTTPError) as exc:
            failures.append(f"{name}: {exc}")
            continue
        return {
            "provider": name,
            "prompt": prompt,
            "promptSource": source,
            "size": size,
            **result,
        }
    raise AiPortraitError(
        "Cả " + str(len(providers)) + " provider đều lỗi → " + " | ".join(failures)
    )


# ── Provider 1: Gemini (Google AI Studio) ──────────────────
def _gemini(cfg: Settings, prompt: str, *, size: int, spec: dict) -> dict[str, str]:
    url = f"{cfg.gemini_base_url}/models/{cfg.gemini_image_model}:generateContent"
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["IMAGE"]},
    }
    try:
        with httpx.Client(timeout=cfg.portrait_timeout) as client:
            res = client.post(url, params={"key": cfg.gemini_api_key}, json=body)
    except httpx.HTTPError as exc:
        raise AiPortraitError(f"không gọi được ({exc.__class__.__name__})")
    if res.status_code in (400, 403) and "API key" in res.text:
        raise AiPortraitError("key sai hoặc chưa bật model ảnh")
    if res.status_code >= 400:
        raise AiPortraitError(f"HTTP {res.status_code}: {res.text[:200]}")

    payload = res.json()
    candidates = payload.get("candidates") or []
    for candidate in candidates:
        for part in (candidate.get("content") or {}).get("parts") or []:
            inline = part.get("inlineData") or part.get("inline_data") or {}
            if inline.get("data"):
                return {
                    "imageBase64": inline["data"],
                    "mimeType": inline.get("mimeType") or "image/png",
                }
    reason = (candidates[0].get("finishReason") if candidates else None) or "không rõ"
    raise AiPortraitError(f"model không trả về ảnh (finishReason: {reason})")


# ── Provider 2: MeToken (API tương thích OpenAI) ───────────
def _metoken(cfg: Settings, prompt: str, *, size: int, spec: dict) -> dict[str, str]:
    url = f"{cfg.metoken_base_url}/images/generations"
    body = {
        "model": cfg.metoken_image_model,
        "prompt": prompt,
        "n": 1,
        "size": f"{size}x{size}",
    }
    headers = {"Authorization": f"Bearer {cfg.metoken_api_key}"}
    try:
        with httpx.Client(timeout=cfg.portrait_timeout) as client:
            res = client.post(url, headers=headers, json=body)
    except httpx.HTTPError as exc:
        raise AiPortraitError(f"không gọi được ({exc.__class__.__name__})")
    if res.status_code == 401:
        raise AiPortraitError("key bị từ chối (401)")
    if res.status_code >= 400:
        raise AiPortraitError(f"HTTP {res.status_code}: {res.text[:200]}")

    items = (res.json() or {}).get("data") or []
    if not items:
        raise AiPortraitError("không có ảnh trong phản hồi")
    item = items[0]
    if item.get("b64_json"):
        return {"imageBase64": item["b64_json"], "mimeType": "image/png"}
    if item.get("url"):
        return {"imageUrl": item["url"], "mimeType": "image/png"}
    raise AiPortraitError("phản hồi thiếu cả b64_json lẫn url")


# ── Provider 3: Pollinations (miễn phí, không cần key) ─────
def _pollinations(cfg: Settings, prompt: str, *, size: int, spec: dict) -> dict[str, str]:
    url = f"{cfg.pollinations_url}/{urllib.parse.quote(prompt, safe='')}"
    params = {
        "width": str(size),
        "height": str(size),
        "seed": str(seed_int(spec)),
        "model": "flux",
        "nologo": "true",
    }
    try:
        with httpx.Client(timeout=cfg.portrait_timeout, follow_redirects=True) as client:
            res = client.get(url, params=params)
    except httpx.HTTPError as exc:
        raise AiPortraitError(f"không gọi được ({exc.__class__.__name__})")
    if res.status_code == 429:
        raise AiPortraitError("bị giới hạn tần suất (429), thử lại sau ~1 phút")
    if res.status_code >= 400:
        raise AiPortraitError(f"HTTP {res.status_code}")
    content_type = (res.headers.get("content-type") or "").split(";")[0].strip()
    if not content_type.startswith("image/"):
        raise AiPortraitError(f"phản hồi không phải ảnh ({content_type or 'không rõ'})")
    return {
        "imageBase64": base64.b64encode(res.content).decode("ascii"),
        "mimeType": content_type,
    }

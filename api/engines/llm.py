"""
llm.py — LLM DeepSeek (API tương thích OpenAI) dùng cho phần "nâng cấp bằng AI".

Vì sao DeepSeek ở đây chứ không phải để vẽ ảnh: DeepSeek mạnh về **ngôn ngữ**
(viết lại prompt ảnh tiếng Anh, viết hồ sơ nhân vật), còn ảnh vẫn do
Gemini → MeToken → Pollinations vẽ (xem `ai_portrait.py`). Ghép lại ta được:

    spec (deterministic, offline)  ->  DeepSeek viết lại prompt  ->  AI vẽ ảnh

Nguyên tắc lỗi: không có `DEEPSEEK_API_KEY` thì hàm ném `LlmError` với thông
báo tiếng Việt chỉ đúng cách khắc phục; `/api/portrait/ai` bắt lỗi này và
**tự lùi về `spec.prompt`** để ảnh vẫn ra (không chặn người dùng).
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

try:                                        # chạy trực tiếp: uvicorn main:app (cwd = api/)
    from config import Settings, settings
except ModuleNotFoundError:                 # chạy kiểu gói: api.main
    from ..config import Settings, settings  # type: ignore[no-redef]


class LlmError(RuntimeError):
    """Lỗi gọi LLM — thông báo tiếng Việt hiển thị thẳng qua toast."""


# ── Prompt hệ thống ────────────────────────────────────────
_SYS_PROMPT_IMAGE = (
    "Bạn là chuyên gia viết prompt ảnh cho model sinh ảnh (Flux/GPT-Image/Gemini). "
    "Nhiệm vụ: từ dữ liệu nhân vật, viết MỘT prompt TIẾNG ANH duy nhất, giàu chi tiết "
    "thị giác (khuôn mặt, tóc, trang phục, ánh sáng, ống kính, bố cục), giữ đúng danh "
    "tính và nét đặc trưng đã cho. Chỉ trả về đúng câu prompt, không giải thích, không "
    "xuống dòng, không đánh số, không dùng markdown, tối đa 340 ký tự."
)

_SYS_CARD = (
    "Bạn là biên tập viên hồ sơ nhân vật cho game/hoạt hình. Trả về DUY NHẤT một object "
    "JSON hợp lệ, không kèm chữ nào khác, đúng các khoá sau:\n"
    '{"description": "<3 đoạn tiếng Việt, mỗi đoạn 1-2 câu, ngăn cách bằng \\n\\n", '
    '"motto": "<câu nói cửa miệng tiếng Việt, tối đa 60 ký tự>", '
    '"prompt": "<prompt ảnh tiếng Anh, tối đa 340 ký tự>", '
    '"traits": ["<3-5 nét tính cách tiếng Việt, mỗi nét 2-4 từ>"]}'
)


def _clean_line(text: str) -> str:
    """Gộp prompt nhiều dòng thành một dòng sạch (bỏ markdown, nháy bao ngoài)."""
    line = " ".join(str(text).split())
    line = re.sub(r"^```[a-zA-Z]*|```$", "", line).strip()
    return line.strip().strip('"').strip("'").strip()


def _extract_json(text: str) -> dict:
    """Lấy object JSON đầu tiên trong câu trả lời (LLM hay bọc ```json ...```)."""
    raw = str(text).strip()
    raw = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", raw).strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start < 0 or end <= start:
            raise LlmError("DeepSeek trả về dữ liệu không phải JSON.")
        try:
            data = json.loads(raw[start:end + 1])
        except json.JSONDecodeError as exc:
            raise LlmError(f"DeepSeek trả về JSON không đọc được: {exc}")
    if not isinstance(data, dict):
        raise LlmError("DeepSeek trả về JSON không phải object.")
    return data


def spec_summary(spec: dict) -> str:
    """Rút gọn spec thành vài dòng tiếng Việt để đưa vào prompt cho LLM."""
    identity = spec.get("identity") or {}
    look = spec.get("appearance") or {}
    outfit = spec.get("outfit") or {}
    labels = spec.get("labels") or {}
    three_d = spec.get("threeD") or {}
    parts = [
        f"- Tên: {identity.get('fullName', '?')} ({labels.get('gender', identity.get('gender', '?'))}, "
        f"{identity.get('age', '?')} tuổi)",
        f"- Nghề: {identity.get('occupationLabel') or labels.get('occupation', '?')}",
        f"- Quê quán: {identity.get('hometown', '?')}",
        f"- Ngoại hình: {look.get('heightCm', '?')} cm, "
        f"{labels.get('build', look.get('build', '?'))}, da {labels.get('skinTone', look.get('skinTone', '?'))}, "
        f"mặt {labels.get('faceShape', look.get('faceShape', '?'))}, "
        f"tóc {labels.get('hairStyle', look.get('hairStyle', '?'))} "
        f"({labels.get('hairColor', look.get('hairColor', '?'))}), "
        f"râu {labels.get('facialHair', look.get('facialHair', '?'))}, "
        f"mắt {labels.get('eyeColor', look.get('eyeColor', '?'))}",
        f"- Trang phục: {outfit.get('label') or labels.get('outfit', '?')} "
        f"({outfit.get('top', '?')}, {outfit.get('bottom', '?')}, {outfit.get('shoes', '?')})",
        f"- Phụ kiện: {labels.get('accessory', spec.get('accessory', 'không'))}",
    ]
    personality = spec.get("personality") or {}
    if personality.get("traits"):
        parts.append(f"- Tính cách: {', '.join(str(t) for t in personality['traits'][:5])}")
    if three_d:
        parts.append(
            f"- Màu dùng trong 3D: da {three_d.get('skin')}, tóc {three_d.get('hair')}, "
            f"áo {three_d.get('top')}, quần {three_d.get('bottom')}, điểm nhấn {three_d.get('accent')}"
        )
    if spec.get("prompt"):
        parts.append(f"- Prompt gốc (tham khảo, cần viết lại tốt hơn): {spec['prompt']}")
    return "\n".join(parts)

class DeepSeekLLM:
    """Client tối giản cho DeepSeek Chat Completions (không cần SDK riêng)."""

    def __init__(self, cfg: Settings | None = None):
        self.cfg = cfg or settings

    # ── Thông tin ──────────────────────────────────────────
    def info(self) -> dict[str, Any]:
        return {
            "provider": "deepseek",
            "ready": self.cfg.llm_ready,
            "model": self.cfg.deepseek_model,
            "baseUrl": self.cfg.deepseek_base_url,
            "usedFor": "viết lại prompt ảnh tiếng Anh · nâng cấp hồ sơ nhân vật",
        }

    # ── Gọi API ────────────────────────────────────────────
    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.6,
        max_tokens: int = 800,
        json_mode: bool = False,
        timeout: float | None = None,
    ) -> str:
        """Trả về nội dung trả lời; lỗi được gói trong `LlmError` (tiếng Việt)."""
        if not self.cfg.llm_ready:
            raise LlmError(
                "Chưa cấu hình DeepSeek: mở .env, điền DEEPSEEK_API_KEY=... "
                "(lấy key ở https://platform.deepseek.com/api_keys) rồi khởi động lại uvicorn."
            )
        body: dict[str, Any] = {
            "model": self.cfg.deepseek_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        url = f"{self.cfg.deepseek_base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.cfg.deepseek_api_key}",
            "Content-Type": "application/json",
        }
        try:
            with httpx.Client(timeout=timeout or self.cfg.deepseek_timeout) as client:
                res = client.post(url, headers=headers, json=body)
        except httpx.HTTPError as exc:
            raise LlmError(f"Không gọi được DeepSeek ({exc.__class__.__name__}): {exc}")
        if res.status_code == 401:
            raise LlmError("DeepSeek từ chối key (401) — kiểm tra DEEPSEEK_API_KEY trong .env.")
        if res.status_code == 402:
            raise LlmError("Tài khoản DeepSeek hết số dư (402) — nạp thêm hoặc tắt tính năng AI.")
        if res.status_code >= 400:
            raise LlmError(f"DeepSeek lỗi HTTP {res.status_code}: {res.text[:300]}")
        try:
            data = res.json()
            content = data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LlmError(f"DeepSeek trả về dữ liệu không mong đợi: {exc}")
        if not str(content).strip():
            raise LlmError("DeepSeek trả về nội dung rỗng.")
        return str(content)

    # ── Nghiệp vụ dùng cho web ─────────────────────────────
    _STYLE_HINT = {
        "realistic": "photorealistic studio portrait, 85mm lens, soft key light",
        "cartoon": "flat cartoon illustration, bold outlines, vivid flat colors",
        "anime": "anime cel-shaded illustration, clean lineart, expressive eyes",
        "cinematic": "cinematic movie still, dramatic rim light, shallow depth of field",
    }

    def refine_image_prompt(
        self, spec: dict, *, style: str | None = None, timeout: float | None = None
    ) -> str | None:
        """Viết lại `spec.prompt` thành prompt ảnh tiếng Anh chi tiết hơn.

        Trả `None` khi chưa cấu hình hoặc DeepSeek lỗi — người gọi tự lùi về
        `spec.prompt` (prompt do Character Engine sinh offline) nên ảnh vẫn ra.
        """
        if not self.cfg.llm_ready:
            return None
        hint = self._STYLE_HINT.get(str(style), "photorealistic studio portrait")
        user = (
            f"Dữ liệu nhân vật:\n{spec_summary(spec)}\n\n"
            f"Phong cách ảnh: {style or spec.get('style') or 'realistic'} ({hint}).\n"
            "Viết lại thành MỘT prompt tiếng Anh hoàn chỉnh: giữ đúng khuôn mặt, tóc, râu, "
            "màu mắt, trang phục, phụ kiện, vóc dáng và tuổi; thêm ánh sáng, ống kính, bố cục."
        )
        try:
            text = self.chat(
                [
                    {"role": "system", "content": _SYS_PROMPT_IMAGE},
                    {"role": "user", "content": user},
                ],
                temperature=0.7,
                max_tokens=400,
                timeout=timeout,
            )
        except LlmError:
            return None
        line = _clean_line(text)[:400]
        return line or None

    def enrich_card(self, spec: dict, *, timeout: float | None = None) -> dict:
        """Nâng cấp hồ sơ: mô tả 3 đoạn, châm ngôn, nét tính cách, prompt ảnh."""
        if not self.cfg.llm_ready:
            raise LlmError(
                "Chưa cấu hình DeepSeek: mở .env, điền DEEPSEEK_API_KEY=... "
                "(lấy key ở https://platform.deepseek.com/api_keys) rồi khởi động lại uvicorn."
            )
        user = (
            f"Dữ liệu nhân vật:\n{spec_summary(spec)}\n\n"
            "Viết lại hồ sơ cho hấp dẫn hơn nhưng PHẢI giữ đúng sự thật đã cho "
            "(không bịa nghề nghiệp, quê quán, tuổi mới)."
        )
        text = self.chat(
            [
                {"role": "system", "content": _SYS_CARD},
                {"role": "user", "content": user},
            ],
            json_mode=True,
            temperature=0.8,
            max_tokens=900,
            timeout=timeout,
        )
        data = _extract_json(text)
        description = str(data.get("description") or "").strip()
        if not description:
            raise LlmError('DeepSeek không trả về trường "description".')
        traits = [str(t).strip() for t in (data.get("traits") or []) if str(t).strip()][:5]
        return {
            "provider": "deepseek",
            "model": self.cfg.deepseek_model,
            "description": description,
            "motto": _clean_line(data.get("motto") or "")[:80],
            "prompt": _clean_line(data.get("prompt") or "")[:400],
            "traits": traits,
        }


# Thể hiện dùng chung cho cả app (đọc lại .env khi tiến trình khởi động).
llm = DeepSeekLLM()


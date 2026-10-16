"""
main.py — Backend FastAPI của MMA NhanVatAI (bước 5 & 6 của lộ trình).

Chạy (giống hướng dẫn trong docs):
    cd api
    uvicorn main:app --port 8077            # thêm --reload khi đang phát triển

Chạy kiểu module từ gốc repo cũng được:
    python -m api.main

Toàn bộ 8 endpoint web đang chờ (hợp đồng đã chốt trong `web/src/api.js`):

    GET    /health                -> { status, version, uptimeSec }
    GET    /api/engines           -> Blender đã cài? có key AI/DeepSeek nào?
    POST   /api/portrait.png      <- { spec, size? }        -> PNG (Pillow)
    POST   /api/glb               <- { spec, rig?, smooth? } -> GLB (Blender headless)
    POST   /api/portrait/ai       <- { spec, style? }        -> { provider, imageBase64|imageUrl }
    GET    /api/library           -> [ bản ghi nhân vật ]
    POST   /api/library           <- { spec }                -> bản ghi đã lưu
    DELETE /api/library/{id}      -> { deleted, id }

Thêm một endpoint mở rộng (không bắt buộc với web):
    POST   /api/ai/character      <- { spec } -> DeepSeek viết lại mô tả/châm ngôn/prompt

Nguyên tắc giữ nguyên như web: **API tắt ⇒ app vẫn dùng đủ**; mọi lỗi trả về
`{ "detail": "<tiếng Việt>" }` để web hiện thẳng qua toast.
"""

from __future__ import annotations

import time
from typing import Any

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

try:                                        # chạy: uvicorn main:app (cwd = api/)
    from config import settings
    from engines import ai_portrait, blender, llm, portrait_png
    from engines.ai_portrait import AiPortraitError
    from engines.blender import BlenderError
    from engines.llm import LlmError
    from library_store import LibraryError, LibraryStore
except ModuleNotFoundError:                 # chạy: python -m api.main
    from .config import settings                            # type: ignore[no-redef]
    from .engines import ai_portrait, blender, llm, portrait_png  # type: ignore[no-redef]
    from .engines.ai_portrait import AiPortraitError        # type: ignore[no-redef]
    from .engines.blender import BlenderError               # type: ignore[no-redef]
    from .engines.llm import LlmError                       # type: ignore[no-redef]
    from .library_store import LibraryError, LibraryStore   # type: ignore[no-redef]

STARTED_AT = time.time()
settings.ensure_dirs()
store = LibraryStore(settings.library_path)

app = FastAPI(
    title="MMA NhanVatAI API",
    version=settings.version,
    description=(
        "Lớp nâng cấp tuỳ chọn cho web tạo nhân vật: Blender headless dựng GLB có rig, "
        "AI vẽ chân dung (Gemini → MeToken → Pollinations, prompt do DeepSeek viết lại), "
        "thư viện nhân vật trên server."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Tiện ích chung ─────────────────────────────────────────
def spec_from(payload: Any) -> dict:
    """Lấy `spec` từ body; thiếu thì báo lỗi tiếng Việt rõ ràng (HTTP 422)."""
    if not isinstance(payload, dict) or not isinstance(payload.get("spec"), dict):
        raise HTTPException(
            status_code=422,
            detail="Body phải là JSON dạng { \"spec\": { ...character card... } }.",
        )
    spec = payload["spec"]
    identity = spec.get("identity")
    if not isinstance(identity, dict) or not str(identity.get("fullName") or "").strip():
        raise HTTPException(
            status_code=422,
            detail="spec không hợp lệ: thiếu identity.fullName — không phải character card của app.",
        )
    return spec


def clamp_size(raw: Any, default: int = 1024, low: int = 128, high: int = 2048) -> int:
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return default
    return max(low, min(high, value))


@app.get("/", summary="Thông tin dịch vụ")
def index() -> dict:
    return {
        "service": "mma-nhanvatai-api",
        "version": settings.version,
        "docs": "/docs",
        "endpoints": [
            "GET /health",
            "GET /api/engines",
            "POST /api/portrait.png",
            "POST /api/glb",
            "POST /api/portrait/ai",
            "POST /api/ai/character",
            "GET /api/library",
            "POST /api/library",
            "DELETE /api/library/{id}",
        ],
        "note": "Web vẫn chạy đầy đủ khi API tắt — đây chỉ là lớp nâng cấp.",
    }


@app.get("/health", summary="Đèn báo xanh/đỏ trên web")
def health() -> dict:
    return {
        "status": "ok",
        "service": "mma-nhanvatai-api",
        "version": settings.version,
        "uptimeSec": round(time.time() - STARTED_AT, 1),
    }


@app.get("/api/engines", summary="Blender đã cài? có key AI nào?")
def engines() -> dict:
    return {
        "blender": blender.blender.info(),
        "llm": llm.llm.info(),
        "ai": ai_portrait.info(),
        "library": {
            "path": str(settings.library_path),
            "count": store.count(),
        },
    }


@app.post("/api/portrait.png", summary="Chân dung PNG vẽ bằng Pillow (offline)")
def portrait_png_endpoint(payload: dict = Body(...)) -> Response:
    spec = spec_from(payload)
    size = clamp_size(payload.get("size"), default=1024)
    caption = str(payload.get("caption") or (spec.get("identity") or {}).get("fullName") or "")
    png = portrait_png.render(spec, size=size, caption=caption)
    return Response(
        content=png,
        media_type="image/png",
        headers={"X-Portrait-Size": str(size), "Cache-Control": "no-store"},
    )


@app.post("/api/glb", summary="Blender headless dựng GLB có rig")
def glb_endpoint(payload: dict = Body(...)) -> Response:
    spec = spec_from(payload)
    options = {
        key: value for key, value in payload.items() if key not in ("spec",)
    }
    try:
        data, meta = blender.blender.build_glb(spec, options)
    except BlenderError as exc:
        # 503: web hiện toast "Dựng GLB lỗi: <detail>" và phần 3D vẫn chạy bình thường
        raise HTTPException(status_code=503, detail=str(exc))
    filename = f"{spec.get('id') or 'nhan-vat'}.glb"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "X-Blender-Seconds": str(meta.get("seconds", "")),
        "X-Glb-Bytes": str(meta.get("bytes", len(data))),
    }
    model = meta.get("model")
    if isinstance(model, dict):
        for key in ("bones", "vertices", "skin"):
            if model.get(key) is not None:
                headers[f"X-Model-{key}"] = str(model[key])
    return Response(content=data, media_type="model/gltf-binary", headers=headers)


@app.post("/api/portrait/ai", summary="AI vẽ chân dung (Gemini → MeToken → Pollinations)")
def portrait_ai_endpoint(payload: dict = Body(...)) -> dict:
    spec = spec_from(payload)
    try:
        return ai_portrait.generate(
            spec,
            style=payload.get("style") or spec.get("style"),
            size=clamp_size(payload.get("size"), default=1024),
            use_llm=bool(payload.get("useLlm", True)),
            prompt_override=payload.get("prompt"),
        )
    except AiPortraitError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/api/ai/character", summary="DeepSeek nâng cấp hồ sơ (endpoint mở rộng)")
def ai_character_endpoint(payload: dict = Body(...)) -> dict:
    spec = spec_from(payload)
    try:
        return llm.llm.enrich_card(spec)
    except LlmError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Thư viện nhân vật trên server ──────────────────────────
@app.get("/api/library", summary="Danh sách nhân vật trên server")
def library_list() -> list:
    try:
        return store.list_items()
    except LibraryError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/library", summary="Lưu/cập nhật một nhân vật")
def library_save(payload: dict = Body(...)) -> dict:
    spec = spec_from(payload)
    try:
        return store.save(spec)
    except LibraryError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.delete("/api/library/{char_id}", summary="Xoá một nhân vật")
def library_delete(char_id: str) -> dict:
    try:
        removed = store.delete(char_id)
    except LibraryError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    if not removed:
        raise HTTPException(
            status_code=404,
            detail=f"Không có nhân vật id “{char_id}” trong thư viện server.",
        )
    return {"deleted": True, "id": char_id}


# ── Lỗi không lường trước: vẫn trả JSON tiếng Việt, không lộ stack trace ──
@app.exception_handler(Exception)
async def unhandled_exception(_request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Lỗi máy chủ ({exc.__class__.__name__}): {exc}. "
                      "Xem log uvicorn để biết chi tiết."
        },
    )


if __name__ == "__main__":                  # python -m api.main
    import uvicorn

    uvicorn.run(app, host=settings.api_host, port=settings.api_port)

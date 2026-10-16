"""
config.py — Nạp cấu hình backend từ `.env` (một nguồn duy nhất).

Quy tắc:
  - `.env` ở gốc repo là chuẩn (xem `.env.example`); `api/.env` (nếu có) chỉ
    bù thêm, KHÔNG ghi đè biến đã có sẵn trong môi trường.
  - Biến rỗng ("") được coi như không đặt — dán nguyên `.env.example` vẫn chạy.
  - Backend chạy được hoàn toàn offline: chỉ `/api/glb` cần Blender và
    `/api/portrait/ai` cần mạng.

Blender: `find_blender()` tự dò theo thứ tự
  BLENDER_PATH -> PATH (`blender`) -> "C:\\Program Files\\Blender Foundation\\*\\blender.exe"
  (bản mới nhất trước) -> đường dẫn macOS/Linux thường gặp.
"""

from __future__ import annotations

import glob
import os
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# ── Đường dẫn gốc ───────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parent.parent      # gốc repo
API_DIR = ROOT_DIR / "api"
BLENDER_DIR = API_DIR / "blender"
DATA_DIR = API_DIR / "data"
TMP_DIR = DATA_DIR / "tmp"
OUTPUT_DIR = DATA_DIR / "output"

# `.env` ở gốc repo nạp trước; biến đã có trong môi trường luôn thắng
# (load_dotenv mặc định không ghi đè) nên test có thể ép cấu hình qua os.environ.
load_dotenv(ROOT_DIR / ".env")
load_dotenv(API_DIR / ".env")

_TRUE = {"1", "true", "yes", "on", "co", "có"}


def _env(name: str, default: str = "") -> str:
    """Đọc biến môi trường; chuỗi rỗng coi như không đặt."""
    raw = os.environ.get(name)
    if raw is None:
        return default
    raw = raw.strip()
    return raw if raw else default


def _flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() in _TRUE


def _int(name: str, default: int) -> int:
    raw = _env(name)
    try:
        return int(float(raw))
    except (TypeError, ValueError):
        return default


# ── Dò Blender ─────────────────────────────────────────────
_WIN_GLOBS = [
    r"C:\Program Files\Blender Foundation\*\blender.exe",
    r"C:\Program Files (x86)\Blender Foundation\*\blender.exe",
]
_OTHER_CANDIDATES = [
    "/usr/bin/blender",
    "/usr/local/bin/blender",
    "/Applications/Blender.app/Contents/MacOS/Blender",
    "/snap/bin/blender",
]


def _version_key(path: str) -> tuple:
    """So sánh 'Blender 5.2' > 'Blender 4.1' để chọn bản mới nhất."""
    nums = [int(n) for n in re.findall(r"\d+", path)]
    return tuple(nums) if nums else (0,)


def find_blender() -> str | None:
    """Trả về đường dẫn blender.exe (hoặc lệnh `blender`) nếu tìm thấy."""
    explicit = _env("BLENDER_PATH")
    if explicit and Path(explicit).exists():
        return str(Path(explicit))
    on_path = shutil.which(explicit or "blender")
    if on_path:
        return on_path
    found: list[str] = []
    for pattern in _WIN_GLOBS:
        found.extend(glob.glob(pattern))
    for candidate in _OTHER_CANDIDATES:
        if Path(candidate).exists():
            found.append(candidate)
    if not found:
        return None
    return sorted(found, key=_version_key, reverse=True)[0]


def _library_path() -> Path:
    """`LIBRARY_DIR` có thể là thư mục (thêm `library.json`) hoặc file `.json`."""
    raw = _env("LIBRARY_DIR")
    if not raw:
        return DATA_DIR / "library.json"
    path = Path(raw)
    if not path.is_absolute():
        path = ROOT_DIR / path
    if path.suffix.lower() == ".json":
        return path
    return path / "library.json"


@dataclass
class Settings:
    """Toàn bộ cấu hình backend (tạo mới bằng `Settings.load()`)."""

    # Server
    api_host: str = "127.0.0.1"
    api_port: int = 8077
    cors_origins: list[str] = field(default_factory=list)

    # Blender
    blender_path: str | None = None
    blender_timeout: int = 240

    # LLM (DeepSeek — API tương thích OpenAI)
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    deepseek_timeout: int = 90

    # AI vẽ ảnh chân dung
    gemini_api_key: str = ""
    gemini_image_model: str = "gemini-2.5-flash-image"
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    metoken_api_key: str = ""
    metoken_base_url: str = "https://api.metoken.ai/v1"
    metoken_image_model: str = "gpt-image-2"
    portrait_allow_pollinations: bool = True
    pollinations_url: str = "https://image.pollinations.ai/prompt"
    portrait_timeout: int = 180

    # Thư viện nhân vật
    library_path: Path = DATA_DIR / "library.json"

    version: str = "1.0.0"

    # ── Nhà máy ────────────────────────────────────────────
    @classmethod
    def load(cls) -> "Settings":
        raw_origins = _env("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        cors = [o for o in (p.strip() for p in raw_origins.replace(" ", ",").split(",")) if o]
        if "*" not in cors:
            # Cho phép thêm cả `vite preview` (4173) cho tiện thử build.
            cors += ["http://localhost:4173", "http://127.0.0.1:4173"]
        return cls(
            api_host=_env("API_HOST", "127.0.0.1"),
            api_port=_int("API_PORT", 8077),
            cors_origins=cors,
            blender_path=find_blender(),
            blender_timeout=_int("BLENDER_TIMEOUT", 240),
            deepseek_api_key=_env("DEEPSEEK_API_KEY"),
            deepseek_base_url=_env("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/"),
            deepseek_model=_env("DEEPSEEK_MODEL", "deepseek-chat"),
            deepseek_timeout=_int("DEEPSEEK_TIMEOUT", 90),
            gemini_api_key=_env("GEMINI_API_KEY"),
            gemini_image_model=_env("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image"),
            gemini_base_url=_env(
                "GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"
            ).rstrip("/"),
            metoken_api_key=_env("METOKEN_API_KEY"),
            metoken_base_url=_env("METOKEN_BASE_URL", "https://api.metoken.ai/v1").rstrip("/"),
            metoken_image_model=_env("METOKEN_IMAGE_MODEL", "gpt-image-2"),
            portrait_allow_pollinations=_flag("PORTRAIT_ALLOW_POLLINATIONS", True),
            pollinations_url=_env(
                "POLLINATIONS_URL", "https://image.pollinations.ai/prompt"
            ).rstrip("/"),
            portrait_timeout=_int("PORTRAIT_TIMEOUT", 180),
            library_path=_library_path(),
        )

    # ── Tiện ích ───────────────────────────────────────────
    def ensure_dirs(self) -> None:
        """Tạo sẵn `api/data/...` (đã nằm trong .gitignore)."""
        for d in (DATA_DIR, TMP_DIR, OUTPUT_DIR):
            d.mkdir(parents=True, exist_ok=True)
        self.library_path.parent.mkdir(parents=True, exist_ok=True)

    @property
    def blender_ready(self) -> bool:
        return bool(self.blender_path) and Path(self.blender_path).exists()

    @property
    def llm_ready(self) -> bool:
        return bool(self.deepseek_api_key)

    def ai_providers(self) -> list[str]:
        """Thứ tự provider vẽ ảnh: Gemini -> MeToken -> Pollinations."""
        providers: list[str] = []
        if self.gemini_api_key:
            providers.append("gemini")
        if self.metoken_api_key:
            providers.append("metoken")
        if self.portrait_allow_pollinations:
            providers.append("pollinations")
        return providers


settings = Settings.load()

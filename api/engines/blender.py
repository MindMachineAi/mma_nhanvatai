"""
blender.py — Gọi Blender **headless** để dựng GLB có rig từ `spec.threeD`.

Cách làm (bước 6 của lộ trình):

    blender.exe -b --factory-startup \
        --python api/blender/build_character.py --python-exit-code 1 \
        -- <spec.json> <out.glb> <options.json>

  - `-b` (background): không mở giao diện -> chạy được trên VPS/Docker, không
    cần màn hình.
  - `--factory-startup`: bỏ qua addon/preferences của người dùng -> kết quả
    giống nhau trên mọi máy (tất định theo spec).
  - `--python-exit-code 1`: lỗi Python trong script ⇒ Blender trả mã thoát 1,
    nhờ đó backend biết chắc là hỏng thay vì đọc file GLB dở dang.

Muốn xem nhân vật dựng **trực tiếp trong Blender đang mở** (kiểu MCP Blender)
thì dùng `api/blender_addon/mma_bridge.py` — cùng script dựng, khác đường vào.
"""

from __future__ import annotations

import json
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any

try:                                            # chạy: uvicorn main:app (cwd = api/)
    from config import BLENDER_DIR, OUTPUT_DIR, TMP_DIR, Settings, settings
except ModuleNotFoundError:                     # chạy kiểu gói: api.main
    from ..config import BLENDER_DIR, OUTPUT_DIR, TMP_DIR, Settings, settings  # type: ignore


class BlenderError(RuntimeError):
    """Lỗi dựng GLB — thông báo tiếng Việt hiển thị thẳng qua toast."""


class BlenderEngine:
    """Bọc một lần chạy Blender headless cho mỗi nhân vật."""

    def __init__(self, cfg: Settings | None = None):
        self.cfg = cfg or settings
        self.script = BLENDER_DIR / "build_character.py"

    # ── Thông tin ──────────────────────────────────────────
    def info(self) -> dict[str, Any]:
        path = self.cfg.blender_path
        version = _probe_version(path) if self.cfg.blender_ready else None
        return {
            "ready": bool(self.cfg.blender_ready and self.script.exists()),
            "path": path,
            "version": version,
            "script": self.script.name if self.script.exists() else None,
            "timeoutSec": self.cfg.blender_timeout,
            "note": "Không tìm thấy Blender ⇒ nút 'Dựng bằng Blender' báo lỗi; "
                    "phần 3D/GLB trong trình duyệt vẫn chạy bình thường.",
        }

    # ── Dựng GLB ───────────────────────────────────────────
    def build_glb(self, spec: dict, options: dict | None = None) -> tuple[bytes, dict]:
        """Dựng GLB, trả `(bytes, meta)`. Ném `BlenderError` khi hỏng."""
        if not self.cfg.blender_ready:
            raise BlenderError(
                "Chưa tìm thấy Blender. Cài Blender rồi đặt BLENDER_PATH trong .env "
                r"(ví dụ BLENDER_PATH=C:\Program Files\Blender Foundation\Blender 5.2\blender.exe), "
                "sau đó khởi động lại uvicorn."
            )
        if not self.script.exists():
            raise BlenderError(f"Thiếu script dựng hình: {self.script}")

        options = {k: v for k, v in (options or {}).items() if v is not None}
        job = uuid.uuid4().hex[:12]
        TMP_DIR.mkdir(parents=True, exist_ok=True)
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        spec_path = TMP_DIR / f"{job}.spec.json"
        opt_path = TMP_DIR / f"{job}.options.json"
        out_path = OUTPUT_DIR / f"{job}.glb"

        spec_path.write_text(json.dumps(spec, ensure_ascii=False), encoding="utf-8")
        opt_path.write_text(json.dumps(options, ensure_ascii=False), encoding="utf-8")

        cmd = [
            str(self.cfg.blender_path),
            "-b",
            "--factory-startup",
            "--python", str(self.script),
            "--python-exit-code", "1",
            "--", str(spec_path), str(out_path), str(opt_path),
        ]
        started = time.time()
        try:
            proc = subprocess.run(       # lệnh do backend tự dựng, không nhận từ người dùng
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=self.cfg.blender_timeout,
                cwd=str(BLENDER_DIR),
            )
        except subprocess.TimeoutExpired as exc:
            self._cleanup(spec_path, opt_path, out_path)
            raise BlenderError(
                f"Blender dựng quá {self.cfg.blender_timeout}s nên bị dừng. "
                "Tăng BLENDER_TIMEOUT trong .env hoặc chọn nhân vật ít chi tiết hơn."
            ) from exc

        elapsed = round(time.time() - started, 2)
        stdout, stderr = proc.stdout or "", proc.stderr or ""
        if proc.returncode != 0 or not out_path.exists():
            self._cleanup(spec_path, opt_path, out_path)
            raise BlenderError(
                f"Blender dựng GLB lỗi (mã {proc.returncode}): {_tail(stderr or stdout)}"
            )

        data = out_path.read_bytes()
        meta: dict[str, Any] = {
            "bytes": len(data),
            "seconds": elapsed,
            "job": job,
            "file": out_path.name,
            "blender": self.cfg.blender_path,
        }
        meta.update(_result_line(stdout))
        self._cleanup(spec_path, opt_path)      # giữ lại .glb trong api/data/output
        return data, meta

    @staticmethod
    def _cleanup(*paths: Path) -> None:
        for path in paths:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass


# ── Hàm phụ trợ ────────────────────────────────────────────
def _tail(text: str, lines: int = 12) -> str:
    """Lấy vài dòng cuối log Blender/Traceback để thông báo lỗi có ích."""
    clean = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    return " ⏐ ".join(clean[-lines:])[:600] or "không có log"


def _result_line(stdout: str) -> dict:
    """Đọc dòng `__MMA_RESULT__{...}` do build_character.py in ra (nếu có)."""
    for line in reversed((stdout or "").splitlines()):
        marker = line.find("__MMA_RESULT__")
        if marker < 0:
            continue
        try:
            return {"model": json.loads(line[marker + len("__MMA_RESULT__"):])}
        except json.JSONDecodeError:
            return {}
    return {}


def _probe_version(path: str | None, timeout: int = 25) -> str | None:
    """`blender --version` -> dòng đầu (dùng cho `/api/engines`)."""
    if not path:
        return None
    try:
        proc = subprocess.run(
            [path, "--version"], capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=timeout,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    first = (proc.stdout or "").strip().splitlines()
    return first[0].strip() if first else None


# Thể hiện dùng chung cho cả app.
blender = BlenderEngine()

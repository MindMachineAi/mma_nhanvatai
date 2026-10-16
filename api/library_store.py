"""
library_store.py — Thư viện nhân vật trên server (bước 5).

Thiết kế:
  - Một file JSON duy nhất (`api/data/library.json` hoặc `LIBRARY_DIR`) chứa
    mảng bản ghi: `{ ...spec, savedAt }` — cùng định dạng web xuất ra nên có
    thể nhập lại vào app bằng nút **Nhập JSON**.
  - Ghi kiểu "atomic": ghi file tạm rồi os.replace -> không bao giờ hỏng file
    khi tiến trình bị tắt giữa chừng.
  - Giới hạn `MAX_ITEMS` bản ghi (mới nhất giữ lại) để file không phình vô hạn.
  - Không phụ thuộc database: chạy được trên mọi máy có Python.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

MAX_ITEMS = 500


class LibraryError(ValueError):
    """Lỗi dữ liệu thư viện — thông báo tiếng Việt trả thẳng cho người dùng."""


def _now_iso() -> str:
    """Thời điểm lưu, có mili-giây để thứ tự "mới nhất lên đầu" luôn chính xác."""
    now = time.time()
    millis = int(round((now - int(now)) * 1000)) % 1000
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(now)) + f".{millis:03d}Z"


def validate_spec(raw: Any) -> dict:
    """Kiểm tra tối thiểu giống `normalizeSpec()` của web (không tự bùa dữ liệu)."""
    if not isinstance(raw, dict):
        raise LibraryError("Trường 'spec' phải là một object JSON (character card).")
    identity = raw.get("identity")
    if not isinstance(identity, dict) or not str(identity.get("fullName") or "").strip():
        raise LibraryError(
            "spec không hợp lệ: thiếu identity.fullName — không phải character card của app này."
        )
    three_d = raw.get("threeD")
    if three_d is not None and not isinstance(three_d, dict):
        raise LibraryError("spec không hợp lệ: 'threeD' phải là object.")
    return raw


class LibraryStore:
    """Kho nhân vật dạng file JSON, an toàn khi web gọi nhiều lần liên tiếp."""

    def __init__(self, path: Path):
        self.path = Path(path)

    # ── Đọc ────────────────────────────────────────────────
    def load(self) -> list[dict]:
        if not self.path.exists():
            return []
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise LibraryError(f"File thư viện {self.path.name} hỏng hoặc không đọc được: {exc}")
        if isinstance(data, dict):            # chấp nhận cả dạng {"items":[...]}
            data = data.get("items", [])
        if not isinstance(data, list):
            raise LibraryError(f"File thư viện {self.path.name} phải chứa một mảng JSON.")
        return [row for row in data if isinstance(row, dict)]

    def list_items(self) -> list[dict]:
        """Mới lưu trước — khớp thứ tự `useLibrary` bên web."""
        items = self.load()
        return sorted(items, key=lambda r: str(r.get("savedAt") or ""), reverse=True)

    def find(self, char_id: str) -> dict | None:
        for row in self.load():
            if str(row.get("id")) == str(char_id):
                return row
        return None

    # ── Ghi ────────────────────────────────────────────────
    def save(self, spec: dict) -> dict:
        """Thêm mới hoặc cập nhật theo `id`; trả về bản ghi đã lưu."""
        record = dict(validate_spec(spec))
        record.setdefault("id", record.get("seed") or f"nv-{int(time.time())}")
        record["savedAt"] = _now_iso()
        record["source"] = "server"

        items = [row for row in self.load() if str(row.get("id")) != str(record["id"])]
        items.append(record)
        items = items[-MAX_ITEMS:]
        self._write(items)
        return record

    def delete(self, char_id: str) -> bool:
        items = self.load()
        kept = [row for row in items if str(row.get("id")) != str(char_id)]
        if len(kept) == len(items):
            return False
        self._write(kept)
        return True

    def count(self) -> int:
        return len(self.load())

    def _write(self, items: list[dict]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, self.path)

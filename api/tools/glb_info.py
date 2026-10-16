"""
glb_info.py — Đọc thẳng file GLB (không cần Blender, không cần three.js).

Dùng để kiểm tra bản dựng Blender có "lành" không:
    python api/tools/glb_info.py api/data/output/<job>.glb

In ra JSON gồm: các chunk, số mesh/material/skin/xương, hộp bao (bbox) tính từ
accessor POSITION, và chiều cao thật của nhân vật. Nhờ vậy có thể kiểm tự động
kiểu "bàn chân chạm sàn, cao đúng heightM" như `tools/selftest3d.mjs` đang làm
cho bản three.js — xem `api/selftest.py` phần "GLB".
"""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

JSON_CHUNK = b"JSON"
BIN_CHUNK = b"BIN\x00"


def read_glb(path: str | Path) -> dict:
    """Tách GLB thành `{ magic, version, length, chunks, gltf, bin }`."""
    data = Path(path).read_bytes()
    if len(data) < 12:
        raise ValueError("File quá nhỏ để là GLB.")
    magic, version, length = struct.unpack("<4sII", data[:12])
    if magic != b"glTF":
        raise ValueError(f"Không phải GLB (magic = {magic!r}).")
    offset, chunks, gltf, binary = 12, [], None, None
    while offset + 8 <= len(data):
        chunk_len, chunk_type = struct.unpack("<I4s", data[offset:offset + 8])
        payload = data[offset + 8:offset + 8 + chunk_len]
        chunks.append({"type": chunk_type.decode("ascii", "replace"), "bytes": chunk_len})
        if chunk_type == JSON_CHUNK and gltf is None:
            gltf = json.loads(payload.decode("utf-8"))
        elif chunk_type == BIN_CHUNK:
            binary = payload
        offset += 8 + chunk_len
    if gltf is None:
        raise ValueError("GLB thiếu chunk JSON.")
    return {
        "magic": magic.decode("ascii"),
        "version": version,
        "length": length,
        "chunks": chunks,
        "gltf": gltf,
        "bin_bytes": len(binary) if binary else 0,
    }


def bbox(gltf: dict) -> dict:
    """Hộp bao theo trục glTF (Y là chiều cao) từ min/max của accessor POSITION."""
    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    for mesh in gltf.get("meshes", []):
        for prim in mesh.get("primitives", []):
            accessor = gltf.get("accessors", [])[prim["attributes"]["POSITION"]]
            for axis in range(3):
                lo[axis] = min(lo[axis], accessor["min"][axis])
                hi[axis] = max(hi[axis], accessor["max"][axis])
    if lo[0] == float("inf"):
        return {"min": None, "max": None, "size": None}
    return {
        "min": [round(v, 4) for v in lo],
        "max": [round(v, 4) for v in hi],
        "size": [round(hi[i] - lo[i], 4) for i in range(3)],
    }


def summarize(path: str | Path) -> dict:
    parsed = read_glb(path)
    gltf = parsed["gltf"]
    skins = gltf.get("skins", [])
    nodes = gltf.get("nodes", [])
    joints = skins[0].get("joints", []) if skins else []
    return {
        "file": Path(path).name,
        "bytes": parsed["length"],
        "version": parsed["version"],
        "chunks": parsed["chunks"],
        "binBytes": parsed["bin_bytes"],
        "meshes": len(gltf.get("meshes", [])),
        "materials": [m.get("name") for m in gltf.get("materials", [])],
        "nodes": len(nodes),
        "skins": len(skins),
        "joints": len(joints),
        "jointNames": [nodes[j].get("name") for j in joints],
        "animations": len(gltf.get("animations", [])),
        "bbox": bbox(gltf),
    }


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__.strip())
        return 2
    for raw in argv[1:]:
        print(json.dumps(summarize(raw), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

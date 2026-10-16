"""
portrait_png.py — Vẽ chân dung 2D bằng Pillow (không cần mạng, không cần GPU).

Đây là bản phía server của `web/src/portrait.js`: cùng đọc `spec.threeD` nên
hình dáng khớp với nhân vật trong khung 3D, nhưng vẽ **dày nét hơn** để in/hồ sơ.
Ưu điểm: chạy được cả khi trình duyệt không hỗ trợ canvas, và trả PNG thật
(web có thể lưu vào hồ sơ, gửi email, in ấn).

Vẽ ở hệ số phóng đại `SS = 4` rồi thu nhỏ bằng LANCZOS -> nét mượt, không răng cưa.
"""

from __future__ import annotations

import io
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# ── Khổ gốc (khớp portrait.js: viewBox 0 0 420 320) ────────
W, H = 420, 320
SS = 4                     # hệ số siêu mẫu khi vẽ
PORTRAIT_RATIO = W / H

# ── "Mood" theo phong cách ảnh (copy bảng STYLE_LOOK của portrait.js) ──
STYLE_LOOK = {
    "realistic": {"bg1": "#eef2f7", "bg2": "#c3ccd9", "line": None, "lw": 0.0, "cheek": 0.10, "rim": 0.15},
    "cartoon": {"bg1": "#fef3c7", "bg2": "#bfdbfe", "line": "#111827", "lw": 5.0, "cheek": 0.30, "rim": 0.0},
    "anime": {"bg1": "#dbeafe", "bg2": "#fbcfe8", "line": "#1f2937", "lw": 3.0, "cheek": 0.35, "rim": 0.50},
    "cinematic": {"bg1": "#0b1220", "bg2": "#1e293b", "line": None, "lw": 0.0, "cheek": 0.06, "rim": 0.85},
}

_FALLBACK_SKIN = (217, 162, 115)
_FONT_CANDIDATES = [
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
_font_cache: dict[int, ImageFont.ImageFont] = {}


# ── Màu ────────────────────────────────────────────────────
def hex_to_rgb(value, fallback: tuple[int, int, int] = _FALLBACK_SKIN) -> tuple[int, int, int]:
    text = str(value or "").strip().lstrip("#")
    if len(text) == 3:
        text = "".join(ch * 2 for ch in text)
    if len(text) != 6:
        return fallback
    try:
        return tuple(int(text[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
    except ValueError:
        return fallback


def darken(color, factor: float = 0.7, fallback=_FALLBACK_SKIN) -> tuple[int, int, int]:
    r, g, b = hex_to_rgb(color, fallback)
    return (int(r * factor), int(g * factor), int(b * factor))


def lighten(color, amount: float = 0.25, fallback=_FALLBACK_SKIN) -> tuple[int, int, int]:
    r, g, b = hex_to_rgb(color, fallback)
    return tuple(int(c + (255 - c) * amount) for c in (r, g, b))  # type: ignore[return-value]


def mix(a, b, t: float = 0.5, fallback=_FALLBACK_SKIN) -> tuple[int, int, int]:
    ra, ga, ba = hex_to_rgb(a, fallback)
    rb, gb, bb = hex_to_rgb(b, fallback)
    return (
        int(ra + (rb - ra) * t),
        int(ga + (gb - ga) * t),
        int(ba + (bb - ba) * t),
    )


def font(size: int) -> ImageFont.ImageFont:
    key = max(8, int(size))
    if key in _font_cache:
        return _font_cache[key]
    chosen: ImageFont.ImageFont = ImageFont.load_default()
    for candidate in _FONT_CANDIDATES:
        if Path(candidate).exists():
            try:
                chosen = ImageFont.truetype(candidate, key)
                break
            except OSError:
                continue
    _font_cache[key] = chosen
    return chosen


# ── Hình học đầu (copy headBox của portrait.js) ─────────────
def head_box(p: dict) -> dict:
    face_ratio = float(p.get("faceRatio") or 1.2)
    jaw_width = float(p.get("jawWidth") or 0.95)
    sy = min(1.16, max(0.86, 0.88 + (face_ratio - 1.05) * 0.4))
    jaw = 0.92 + jaw_width * 0.1
    return {"cx": 160.0, "cy": 178.0, "rx": 62.0 * jaw, "ry": 76.0 * sy, "jaw": jaw, "sy": sy}


def _s(v: float) -> float:
    """Đổi toạ độ hệ 420x320 -> hệ canvas đã siêu mẫu."""
    return v * SS


def _scaled_box(box) -> list[float]:
    return [_s(v) for v in box]


def _stroke(line, lw: float) -> dict:
    """Tham số viền cho Pillow: Pillow yêu cầu `width` là SỐ NGUYÊN.

    `look["lw"]` trong portrait.js là số thực (0 / 3 / 5) nên phải ép int,
    nếu không `rounded_rectangle`/`ellipse` sẽ ném TypeError khi vẽ phong cách
    cartoon/anime (đã từng xảy ra, xem test nhóm 4 của api/selftest.py).
    """
    if not line:
        return {}
    return {"outline": line, "width": max(1, int(round(_s(lw))))}


def gradient(size: tuple[int, int], c1, c2) -> Image.Image:
    """Nền chuyển màu dọc (không cần numpy)."""
    top, bottom = hex_to_rgb(c1), hex_to_rgb(c2)
    img = Image.new("RGB", (1, size[1]))
    draw = ImageDraw.Draw(img)
    for y in range(size[1]):
        t = y / max(1, size[1] - 1)
        draw.point((0, y), fill=(
            int(top[0] + (bottom[0] - top[0]) * t),
            int(top[1] + (bottom[1] - top[1]) * t),
            int(top[2] + (bottom[2] - top[2]) * t),
        ))
    return img.resize(size, Image.BILINEAR)


# ── Tóc ────────────────────────────────────────────────────
def _hair_back(draw: ImageDraw.ImageDraw, mesh: str, hb: dict, color, line, lw: float) -> None:
    cx, cy, rx, ry = hb["cx"], hb["cy"], hb["rx"], hb["ry"]
    stroke = _stroke(line, lw)

    if mesh == "long":
        draw.rounded_rectangle(
            _scaled_box([cx - rx * 1.3, cy - ry * 1.1, cx + rx * 1.3, cy + ry * 2.4]),
            radius=int(_s(rx * 0.5)), fill=color, **stroke,
        )
    elif mesh == "bob":
        draw.ellipse(_scaled_box([cx - rx * 1.3, cy - ry * 1.1, cx + rx * 1.3, cy + ry * 1.46]),
                     fill=color, **stroke)
    elif mesh == "afro":
        r = _s(rx * 1.5)
        draw.ellipse(_scaled_box([cx - rx * 1.5, cy - ry * 1.66, cx + rx * 1.5, cy + ry * 0.74]),
                     fill=color, **stroke)
    elif mesh == "ponytail":
        draw.ellipse(_scaled_box([cx + rx * 0.5, cy - ry * 0.55, cx + rx * 1.35, cy + ry * 1.55]),
                     fill=color, **stroke)
    elif mesh == "twintail":
        for side in (-1, 1):
            draw.ellipse(_scaled_box([
                cx + side * rx * 1.15 - rx * 0.34, cy - ry * 0.6,
                cx + side * rx * 1.15 + rx * 0.34, cy + ry * 1.3,
            ]), fill=color, **stroke)
    else:                                     # short / curly / buzz / side / bald / mohawk
        draw.ellipse(_scaled_box([cx - rx * 1.09, cy - ry * 1.12, cx + rx * 1.09, cy + ry * 0.92]),
                     fill=color, **stroke)


def _hair_front(draw: ImageDraw.ImageDraw, mesh: str, hb: dict, color, skin, line, lw: float) -> None:
    cx, cy, rx, ry = hb["cx"], hb["cy"], hb["rx"], hb["ry"]
    stroke = _stroke(line, lw)

    if mesh == "bald":
        return
    top_box = _scaled_box([cx - rx * 1.03, cy - ry * 1.14, cx + rx * 1.03, cy + ry * 0.82])
    if mesh == "buzz":
        draw.pieslice(top_box, 180, 360, fill=mix(color, skin, 0.35), **stroke)
        return
    draw.pieslice(top_box, 180, 360, fill=color, **stroke)

    if mesh == "side":
        draw.polygon([_s(cx - rx * 0.95), _s(cy - ry * 0.3), _s(cx - rx * 0.1), _s(cy + ry * 0.2),
                      _s(cx - rx * 0.25), _s(cy - ry * 0.55)], fill=color, **stroke)
    elif mesh == "mohawk":
        draw.rectangle(_scaled_box([cx - rx * 0.3, cy - ry * 1.6, cx + rx * 0.3, cy - ry * 0.4]),
                       fill=color, **stroke)
    elif mesh == "curly":
        for i in range(5):
            angle = math.pi * (1 + i / 4)
            px, py = cx + math.cos(angle) * rx * 0.9, cy - ry * 0.55 + math.sin(angle) * ry * 0.35
            draw.ellipse(_scaled_box([px - rx * 0.24, py - rx * 0.24, px + rx * 0.24, py + rx * 0.24]),
                         fill=color, **stroke)


# ── Mặt ────────────────────────────────────────────────────
def _face(draw: ImageDraw.ImageDraw, hb: dict, colors: dict, look: dict, mesh: dict) -> None:
    cx, cy, rx, ry = hb["cx"], hb["cy"], hb["rx"], hb["ry"]
    skin, shade = colors["skin"], colors["shade"]
    stroke = _stroke(look["line"], look["lw"])

    # Tai
    for side in (-1, 1):
        draw.ellipse(_scaled_box([cx + side * rx * 1.0 - rx * 0.14, cy - rx * 0.2,
                                  cx + side * rx * 1.0 + rx * 0.14, cy + rx * 0.26]),
                     fill=shade, **stroke)
    # Mắt: lòng trắng -> mống mắt -> con ngươi -> đốm sáng
    eye_r = rx * 0.2
    for side in (-1, 1):
        ex, ey = cx + side * rx * 0.38, cy + ry * 0.04
        draw.ellipse(_scaled_box([ex - eye_r, ey - eye_r * 0.72, ex + eye_r, ey + eye_r * 0.72]),
                     fill="#f7f7f7", **stroke)
        draw.ellipse(_scaled_box([ex - eye_r * 0.62, ey - eye_r * 0.62, ex + eye_r * 0.62, ey + eye_r * 0.62]),
                     fill=colors["eye"])
        draw.ellipse(_scaled_box([ex - eye_r * 0.26, ey - eye_r * 0.26, ex + eye_r * 0.26, ey + eye_r * 0.26]),
                     fill="#11161d")
        draw.ellipse(_scaled_box([ex + eye_r * 0.06, ey - eye_r * 0.36, ex + eye_r * 0.3, ey - eye_r * 0.12]),
                     fill="#ffffff")
    # Lông mày
    for side in (-1, 1):
        bx, by = cx + side * rx * 0.38, cy - ry * 0.24
        draw.line([_s(bx - rx * 0.2), _s(by + (0.02 if side > 0 else -0.02) * ry),
                   _s(bx + rx * 0.2), _s(by - (0.02 if side > 0 else -0.02) * ry)],
                  fill=colors["hair"], width=max(2, int(_s(rx * 0.09))))
    # Má hồng (theo phong cách) — trộn màu thủ công, không cần alpha
    if look["cheek"] > 0.12:
        blush = mix(skin, "#d9534f", look["cheek"])
        for side in (-1, 1):
            bx = cx + side * rx * 0.62
            draw.ellipse(_scaled_box([bx - rx * 0.2, cy + ry * 0.2, bx + rx * 0.2, cy + ry * 0.46]),
                         fill=blush)
    # Mũi
    draw.line([_s(cx + rx * 0.06), _s(cy - ry * 0.02), _s(cx - rx * 0.02), _s(cy + ry * 0.26)],
              fill=shade, width=max(1, int(_s(rx * 0.045))))
    # Miệng
    mouth_box = _scaled_box([cx - rx * 0.24, cy + ry * 0.34, cx + rx * 0.24, cy + ry * 0.62])
    draw.arc(mouth_box, 0, 180, fill=mix(shade, "#7a2f2f", 0.45),
             width=max(2, int(_s(rx * 0.075))))
    # Râu
    _beard(draw, hb, colors, mesh.get("facialHairMesh", "none"), stroke)


def _beard(draw: ImageDraw.ImageDraw, hb: dict, colors: dict, mesh: str, stroke: dict) -> None:
    cx, cy, rx, ry = hb["cx"], hb["cy"], hb["rx"], hb["ry"]
    hair, skin = colors["hair"], colors["skin"]
    if mesh == "none":
        return
    if mesh == "stubble":
        draw.pieslice(_scaled_box([cx - rx, cy - ry * 1.05, cx + rx, cy + ry * 1.05]), 20, 160,
                      fill=mix(hair, skin, 0.62))
        return
    if mesh in ("mustache", "goatee"):
        draw.ellipse(_scaled_box([cx - rx * 0.34, cy + ry * 0.3, cx + rx * 0.34, cy + ry * 0.5]),
                     fill=hair, **stroke)
    if mesh == "goatee":
        draw.ellipse(_scaled_box([cx - rx * 0.22, cy + ry * 0.74, cx + rx * 0.22, cy + ry * 1.18]),
                     fill=hair, **stroke)
    if mesh == "beard":
        draw.pieslice(_scaled_box([cx - rx * 1.02, cy - ry * 1.02, cx + rx * 1.02, cy + ry * 1.3]),
                      10, 170, fill=hair, **stroke)
        draw.ellipse(_scaled_box([cx - rx * 0.42, cy + ry * 0.9, cx + rx * 0.42, cy + ry * 1.5]),
                     fill=hair, **stroke)


def _head_accessory(draw: ImageDraw.ImageDraw, hb: dict, mesh: str, colors: dict, look: dict) -> None:
    cx, cy, rx, ry = hb["cx"], hb["cy"], hb["rx"], hb["ry"]
    accent, dark = colors["accent"], (31, 41, 55)
    stroke = _stroke(look["line"], look["lw"])

    if mesh == "glasses":
        for side in (-1, 1):
            ex = cx + side * rx * 0.38
            draw.ellipse(_scaled_box([ex - rx * 0.28, cy - ry * 0.16, ex + rx * 0.28, cy + ry * 0.26]),
                         outline=dark, width=max(2, int(_s(rx * 0.07))))
        draw.line([_s(cx - rx * 0.12), _s(cy + ry * 0.05), _s(cx + rx * 0.12), _s(cy + ry * 0.05)],
                  fill=dark, width=max(2, int(_s(rx * 0.05))))
    elif mesh == "sunglasses":
        for side in (-1, 1):
            ex = cx + side * rx * 0.38
            draw.rounded_rectangle(
                _scaled_box([ex - rx * 0.32, cy - ry * 0.16, ex + rx * 0.32, cy + ry * 0.24]),
                radius=int(_s(rx * 0.1)), fill=(11, 18, 32), **stroke)
        draw.line([_s(cx - rx * 0.1), _s(cy + ry * 0.04), _s(cx + rx * 0.1), _s(cy + ry * 0.04)],
                  fill=(11, 18, 32), width=max(2, int(_s(rx * 0.06))))
    elif mesh == "cap":
        draw.pieslice(_scaled_box([cx - rx * 1.06, cy - ry * 1.06, cx + rx * 1.06, cy + ry * 1.06]),
                      180, 360, fill=accent, **stroke)
        draw.ellipse(_scaled_box([cx - rx * 0.5, cy - ry * 0.22, cx + rx * 1.9, cy + ry * 0.3]),
                     fill=lighten(accent, 0.1), **stroke)
    elif mesh == "sunhat":
        draw.ellipse(_scaled_box([cx - rx * 2.3, cy - ry * 0.62, cx + rx * 2.3, cy + ry * 0.38]),
                     fill=(230, 211, 163), **stroke)
        draw.pieslice(_scaled_box([cx - rx * 1.2, cy - ry * 1.6, cx + rx * 1.2, cy + ry * 0.2]),
                      180, 360, fill=(230, 211, 163), **stroke)
        draw.rectangle(_scaled_box([cx - rx * 1.21, cy - ry * 0.28, cx + rx * 1.21, cy + ry * 0.02]),
                       fill=accent)
    elif mesh == "hardhat":
        draw.pieslice(_scaled_box([cx - rx * 1.18, cy - ry * 1.3, cx + rx * 1.18, cy + ry * 0.6]),
                      180, 360, fill=accent, **stroke)
        draw.ellipse(_scaled_box([cx - rx * 1.5, cy - ry * 0.18, cx + rx * 1.5, cy + ry * 0.22]),
                     fill=lighten(accent, 0.12), **stroke)
    elif mesh == "headset":
        draw.arc(_scaled_box([cx - rx * 1.1, cy - ry * 1.25, cx + rx * 1.1, cy + ry * 0.95]),
                 180, 360, fill=dark, width=max(3, int(_s(rx * 0.11))))
        for side in (-1, 1):
            ex = cx + side * rx * 1.05
            draw.rounded_rectangle(
                _scaled_box([ex - rx * 0.16, cy - ry * 0.08, ex + rx * 0.16, cy + ry * 0.42]),
                radius=int(_s(rx * 0.08)), fill=dark)
    elif mesh == "earring":
        for side in (-1, 1):
            ex, ey = cx + side * rx * 1.02, cy + rx * 0.22
            draw.ellipse(_scaled_box([ex - rx * 0.1, ey - rx * 0.1, ex + rx * 0.1, ey + rx * 0.1]),
                         fill=accent)


def _body_accessory(draw: ImageDraw.ImageDraw, hb: dict, mesh: str, colors: dict,
                    shoulder_y: float) -> None:
    """Phụ kiện vẽ trên thân (khớp `accBody` của portrait.js)."""
    cx = hb["cx"]
    accent = colors["accent"]
    if mesh == "necklace":
        draw.arc(_scaled_box([cx - 30, shoulder_y - 26, cx + 30, shoulder_y + 16]), 0, 180,
                 fill=accent, width=max(2, int(_s(2.6))))
    elif mesh == "scarf":
        draw.rounded_rectangle(_scaled_box([cx - 44, shoulder_y - 30, cx + 44, shoulder_y + 4]),
                               radius=int(_s(10)), fill=accent)
        draw.rounded_rectangle(_scaled_box([cx + 10, shoulder_y - 6, cx + 30, shoulder_y + 52]),
                               radius=int(_s(8)), fill=darken(accent, 0.82))
    elif mesh == "backpack":
        for side in (-1, 1):
            draw.line([_s(cx + side * 58), _s(shoulder_y - 4), _s(cx + side * 40), _s(shoulder_y + 92)],
                      fill=darken(accent, 0.7), width=max(3, int(_s(7))))


def render(spec: dict, *, size: int = 1024, caption: str = "") -> bytes:
    """Dựng PNG chân dung (bán thân) từ spec; trả về bytes PNG."""
    three_d = spec.get("threeD") or spec
    look = STYLE_LOOK.get(str(spec.get("style") or "realistic"), STYLE_LOOK["realistic"])
    hb = head_box(three_d)
    cx, cy, rx, ry = hb["cx"], hb["cy"], hb["rx"], hb["ry"]

    colors = {
        "skin": hex_to_rgb(three_d.get("skin")),
        "shade": hex_to_rgb(three_d.get("skinShade") or three_d.get("skin")),
        "hair": hex_to_rgb(three_d.get("hair"), (27, 27, 31)),
        "eye": hex_to_rgb(three_d.get("eye"), (91, 58, 30)),
        "top": hex_to_rgb(three_d.get("top"), (59, 130, 246)),
        "accent": hex_to_rgb(three_d.get("accent"), (245, 158, 11)),
    }
    mesh = {
        "hair": str(three_d.get("hairMesh") or "short"),
        "facialHair": str(three_d.get("facialHairMesh") or "none"),
        "accessory": str(three_d.get("accessoryMesh") or "none"),
    }

    img = gradient((W * SS, H * SS), look["bg1"], look["bg2"])
    draw = ImageDraw.Draw(img)
    stroke = _stroke(look["line"], look["lw"])

    # Thân: vai + cổ + đường xẻ áo (bán thân, cắt ở mép dưới khung)
    shoulder_y = cy + ry * 1.9
    draw.rounded_rectangle(_scaled_box([cx - 118, shoulder_y, cx + 118, H + 20]),
                           radius=int(_s(46)), fill=colors["top"], **stroke)
    draw.rounded_rectangle(_scaled_box([cx - 34, cy + ry * 0.86, cx + 34, shoulder_y + 14]),
                           radius=int(_s(12)), fill=colors["shade"], **stroke)
    draw.ellipse(_scaled_box([cx - 74, shoulder_y - 6, cx + 74, shoulder_y + 60]),
                 fill=lighten(colors["top"], 0.06))
    draw.line([_s(cx), _s(shoulder_y + 6), _s(cx), _s(H + 10)],
              fill=darken(colors["top"], 0.88), width=max(2, int(_s(3))))

    _hair_back(draw, mesh["hair"], hb, colors["hair"], look["line"], look["lw"])
    draw.ellipse(_scaled_box([cx - rx, cy - ry, cx + rx, cy + ry]),
                 fill=colors["skin"], **stroke)
    _face(draw, hb, colors, look, {"facialHairMesh": mesh["facialHair"]})
    _hair_front(draw, mesh["hair"], hb, colors["hair"], colors["skin"], look["line"], look["lw"])
    _head_accessory(draw, hb, mesh["accessory"], colors, look)
    _body_accessory(draw, hb, mesh["accessory"], colors, shoulder_y)

    # Ánh viền theo phong cách (anime / cinematic)
    if look["rim"] > 0.1:
        draw.arc(_scaled_box([cx + 6, cy - ry * 1.02, cx + rx * 2.4, cy + ry * 1.02]), 300, 60,
                 fill=(207, 227, 255), width=max(2, int(_s(4))))

    # Dải tên nhân vật (nếu có)
    if caption:
        draw.rectangle(_scaled_box([0, H - 52, W, H]), fill=(15, 23, 42))
        draw.text((_s(16), _s(H - 46)), str(caption), font=font(int(19 * SS)), fill=(255, 255, 255))

    img = img.resize((max(64, int(size)), max(48, int(round(size / PORTRAIT_RATIO)))), Image.LANCZOS)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()

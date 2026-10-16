"""
build_character.py — Dựng nhân vật 3D **có rig** bằng Blender headless (bpy).

Chạy:
    blender -b --factory-startup --python build_character.py --python-exit-code 1 \
            -- <spec.json> <out.glb> [options.json]

Nguyên tắc:
  - Đầu vào là `spec.threeD` — **cùng hợp đồng** mà `web/src/viewer/figure.js`
    đang dùng, nên nhân vật Blender khớp với bản xem trước trong trình duyệt;
    công thức tỉ lệ trong `proportions()` được port 1:1 từ figure.js.
  - Chỉ dùng hình khối nguyên thuỷ (cầu, trụ, hộp, xuyến) ⇒ không tải asset,
    chạy offline, nhanh (mỗi nhân vật vài giây).
  - Kết quả: 1 mesh `body` (đã nối tóc/râu/phụ kiện) + 1 armature `rig` 19 xương,
    skin bằng automatic weights (lùi về envelope nếu heat weighting thất bại).

Hệ trục trong Blender: X = phải, Y = độ sâu (**mặt nhân vật hướng -Y**),
Z = chiều cao (mét, gốc ở bàn chân). Khi export GLB với `export_yup=True`,
glTF đổi sang Y-up và -Y (mặt) thành **+Z** ⇒ đúng quy ước "mặt hướng +Z"
đã ghi trong docs/KIEN_TRUC.md §5.

Options (`options.json`, đều tuỳ chọn):
    rig         true/false   — có tạo armature + skin hay không (mặc định true)
    smooth      true/false   — bật shading mượt (mặc định true)
    keep_parts  true/false   — giữ từng phần rời để soi lỗi (mặc định false)
"""

from __future__ import annotations

import json
import math
import os
import sys
import traceback

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector   # chuyển hệ trục three.js -> Blender

# ── Màu: hex (sRGB, như trong spec) -> linear (Blender/glTF làm việc ở linear) ──
def srgb_to_linear(channel: float) -> float:
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def hex_to_linear(value: str, fallback: tuple = (0.8, 0.6, 0.45)) -> tuple:
    text = str(value or "").strip().lstrip("#")
    if len(text) == 3:
        text = "".join(c * 2 for c in text)
    if len(text) != 6:
        return fallback
    try:
        rgb = [int(text[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    except ValueError:
        return fallback
    return tuple(srgb_to_linear(c) for c in rgb)


def material(name: str, color: str, *, rough: float = 0.75, metal: float = 0.05,
             alpha: float = 1.0) -> bpy.types.Material:
    """Vật liệu Principled — thông số khớp `mat()` trong figure.js."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    rgb = hex_to_linear(color)
    bsdf.inputs["Base Color"].default_value = (*rgb, alpha)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
    return mat


def darken(color: str, factor: float = 0.7) -> str:
    """Nhân kênh màu theo hệ số (giống darken() của engine/color.js)."""
    text = str(color or "").strip().lstrip("#")
    if len(text) == 3:
        text = "".join(c * 2 for c in text)
    if len(text) != 6:
        return "#777777"
    try:
        parts = [max(0, min(255, int(int(text[i:i + 2], 16) * factor))) for i in (0, 2, 4)]
    except ValueError:
        return "#777777"
    return "#%02x%02x%02x" % tuple(parts)


# ── Đổi hệ trục three.js (Y lên, Z tới trước) -> Blender (Z lên, -Y tới trước) ──
# M = phép quay +90° quanh X: (x, y_lên, z_trước) -> (x, -z_trước, y_lên).
# Dùng đúng một phép quay cho CẢ vị trí lẫn hướng, nên hình dáng không bị lật.
_M = Matrix.Rotation(math.radians(90.0), 3, "X")


def loc(x: float, up: float, front: float) -> tuple:
    """Vị trí trong hệ three.js -> toạ độ Blender."""
    v = _M @ Vector((x, up, front))
    return (v.x, v.y, v.z)


def rot(rx: float, ry: float, rz: float) -> tuple:
    """Euler XYZ (radian) trong hệ three.js -> Euler XYZ của Blender."""
    r = Euler((rx, ry, rz), "XYZ").to_matrix()
    return tuple((_M @ r @ _M.transposed()).to_euler("XYZ"))


def axis(rx: float, ry: float, rz: float) -> tuple:
    """Trục dài của capsule SAU khi xoay, **trong hệ three.js**.

    CapsuleGeometry(radius, length) của three.js dài theo trục Y, còn trụ của
    Blender dài theo trục Z — hai hệ lệch nhau đúng phép quay `_M`, nên hàm này
    KHÔNG nhân `_M`. Trả về vector trong hệ three.js để cộng được với `pos`
    (cũng là toạ độ three.js) trước khi `loc()` đổi sang Blender.
    """
    v = Euler((rx, ry, rz), "XYZ").to_matrix() @ Vector((0.0, 1.0, 0.0))
    return (v.x, v.y, v.z)


PARTS: list = []            # mọi phần của nhân vật (nối thành 1 mesh ở cuối)


def _finish(obj, mat, smooth: bool, name: str):
    obj.name = name
    obj.data.name = name
    obj.data.materials.append(mat)
    if smooth:
        for poly in obj.data.polygons:
            poly.use_smooth = True
    PARTS.append(obj)
    return obj


def sphere(name, radius, pos, mat, *, scale=(1, 1, 1), rotation=(0, 0, 0),
           seg=24, rings=16, smooth=True):
    """Khối cầu/cầu dẹt: `scale` là (x, lên, trước) theo hệ three.js."""
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=seg, ring_count=rings, radius=radius,
        location=loc(*pos), rotation=rot(*rotation),
        scale=(scale[0], scale[2], scale[1]),
    )
    return _finish(bpy.context.active_object, mat, smooth, name)


def band(name, radius, theta_start, theta_end, pos, mat, *, scale=(1, 1, 1),
         rotation=(0, 0, 0), seg=24, rings=16, smooth=True):
    """Chỏm cầu: chỉ giữ phần có góc cực trong [theta_start, theta_end] (radian).

    Dùng cho tóc (cap), râu (stubble/mustache/beard) — tương ứng tham số
    `thetaStart/thetaLength` của three.js SphereGeometry.
    """
    obj = sphere(name, radius, pos, mat, scale=scale, rotation=rotation,
                 seg=seg, rings=rings, smooth=smooth)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    doomed = []
    for vert in bm.verts:
        ratio = max(-1.0, min(1.0, vert.co.z / radius))
        angle = math.acos(ratio)
        if angle < theta_start - 1e-6 or angle > theta_end + 1e-6:
            doomed.append(vert)
    if doomed:
        bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def capsule(name, radius, length, pos, mat, *, rotation=(0, 0, 0), seg=16,
            scale=(1, 1, 1), smooth=True):
    """CapsuleGeometry(radius, length) của three.js: cao `length + 2*radius`.

    `scale` theo hệ three.js (x, lên, trước) — dùng để dẹt thân người theo
    chiều sâu như `scale=[1, 1, torsoD/torsoW]` trong figure.js.
    """
    total = max(0.01, float(length)) + 2.0 * radius
    ax, ay, az = axis(*rotation)
    bl_scale = (scale[0], scale[2], scale[1])
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=seg, radius=radius, depth=total,
        location=loc(*pos), rotation=rot(*rotation), scale=bl_scale,
    )
    obj = _finish(bpy.context.active_object, mat, smooth, name)
    for sign in (1.0, -1.0):
        end = (pos[0] + ax * sign * total / 2,
               pos[1] + ay * sign * total / 2,
               pos[2] + az * sign * total / 2)
        sphere(f"{name}_cap", radius, end, mat, scale=scale, seg=seg,
               rings=max(8, seg // 2), smooth=smooth)
    return obj


def box(name, size, pos, mat, *, rotation=(0, 0, 0), smooth=False):
    """Hộp: `size` là (rộng_x, cao_lên, sâu_trước) theo hệ three.js."""
    bpy.ops.mesh.primitive_cube_add(
        size=1.0, location=loc(*pos), rotation=rot(*rotation),
        scale=(size[0], size[2], size[1]),
    )
    return _finish(bpy.context.active_object, mat, smooth, name)


def cylinder(name, r_top, r_bottom, height, pos, mat, *, rotation=(0, 0, 0),
             seg=20, smooth=True):
    bpy.ops.mesh.primitive_cone_add(
        vertices=seg, radius1=r_bottom, radius2=r_top, depth=height,
        location=loc(*pos), rotation=rot(*rotation),
    )
    return _finish(bpy.context.active_object, mat, smooth, name)


def torus(name, major, minor, pos, mat, *, rotation=(0, 0, 0), major_seg=24,
          minor_seg=10, smooth=True):
    """Xuyến (gọng kính, hoa tai, khăn...).

    Blender dựng xuyến nằm trong mặt phẳng XY với trục +Z, còn three.js
    TorusGeometry cũng nằm trong XY nhưng trục quay là +Z *của three.js*
    (tức "hướng ra trước"). Vì vậy phải xoay dữ liệu mesh -90° quanh X để
    hai bên trùng hướng trước khi áp `rotation` — nếu không, hình sẽ lệch 90°.
    """
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor,
        major_segments=major_seg, minor_segments=minor_seg,
        location=loc(*pos), rotation=rot(*rotation),
    )
    obj = bpy.context.active_object
    obj.data.transform(Matrix.Rotation(math.radians(-90.0), 4, "X"))
    return _finish(obj, mat, smooth, name)


# ── Tỉ lệ cơ thể: port 1:1 từ proportions() của web/src/viewer/figure.js ────
def proportions(p: dict) -> dict:
    height_m = float(p.get("heightM") or 1.7)
    mass = float(p.get("mass") or 1.0)
    width = float(p.get("width") or 1.0)
    gender = str(p.get("gender") or "nam")
    narrow = 0.9 if gender == "nu" else (0.95 if gender == "phi_nhi" else 1.0)
    h = height_m / 7.4                      # chiều cao 1 đầu
    return {
        "H": height_m,
        "h": h,
        "headR": h * 0.5,
        "neckH": h * 0.28,
        "legH": height_m * 0.47,
        "thighR": h * 0.20 * mass,
        "shinR": h * 0.16 * mass,
        "hipW": h * 0.36 * width * (1.06 if gender == "nu" else 1.0),
        "torsoH": height_m * 0.30,
        "torsoW": h * 0.52 * mass * narrow,
        "torsoD": h * 0.34 * mass,
        "shoulderW": h * 0.62 * width * narrow,
        "upperArmR": h * 0.115 * mass,
        "foreArmR": h * 0.10 * mass,
        "upperArmL": height_m * 0.16,
        "foreArmL": height_m * 0.155,
        "footL": h * 0.55,
    }


def add(x: float, y: float, z: float, dx: float = 0.0, dy: float = 0.0, dz: float = 0.0) -> tuple:
    """Cộng offset (x, lên, trước) — giữ code dựng hình đọc như hình học."""
    return (x + dx, y + dy, z + dz)


PI = math.pi


# ── Tóc: 12 mesh id trong HAIR_STYLES (xem web/src/viewer/figure.js) ────────
def build_hair(base: tuple, mesh_id: str, radius: float, sy: float, mat) -> None:
    x, up, front = base
    r = radius * 1.03
    scale = (1.0, sy, 1.02)

    if mesh_id == "bald":
        return
    if mesh_id == "buzz":
        band("hair_buzz", r, 0.0, PI * 0.5, base, mat, scale=scale)
    elif mesh_id == "short":
        band("hair_cap", r, 0.0, PI * 0.58, base, mat, scale=scale)
        sphere("hair_nape", r * 0.5, add(x, up, front, 0, -r * 0.12, -r * 0.62), mat,
               scale=(1.6, 0.9, 0.7))
    elif mesh_id == "side":
        band("hair_cap", r, 0.0, PI * 0.58, base, mat, scale=scale)
        box("hair_fringe", (r * 0.9, r * 0.5, r * 0.35),
            add(x, up, front, -r * 0.45, r * 0.62, r * 0.55), mat,
            rotation=(0.25, 0.2, 0.35))
    elif mesh_id == "curly":
        band("hair_cap", r * 1.04, 0.0, PI * 0.66, base, mat, scale=scale)
        for i in range(7):
            angle = (i / 7.0) * PI * 2
            sphere(f"hair_curl{i}", r * 0.3,
                   add(x, up, front, math.cos(angle) * r * 0.82,
                       r * 0.55 - (i % 2) * r * 0.22, math.sin(angle) * r * 0.82), mat)
    elif mesh_id == "long":
        band("hair_cap", r, 0.0, PI * 0.6, base, mat, scale=scale)
        box("hair_back", (r * 1.75, r * 2.4, r * 0.55), add(x, up, front, 0, -r, -r * 0.52), mat)
        for side in (-1, 1):
            box(f"hair_side{side}", (r * 0.42, r * 1.9, r * 1.1),
                add(x, up, front, side * r * 0.95, -r * 0.75, -r * 0.1), mat)
    elif mesh_id == "ponytail":
        band("hair_cap", r, 0.0, PI * 0.58, base, mat, scale=scale)
        capsule("hair_tail", r * 0.28, r * 1.5, add(x, up, front, 0, -r * 0.55, -r * 0.95),
                mat, rotation=(0.45, 0, 0))
    elif mesh_id == "bun":
        band("hair_cap", r, 0.0, PI * 0.58, base, mat, scale=scale)
        sphere("hair_bun", r * 0.45, add(x, up, front, 0, r * 0.75, -r * 0.75), mat,
               scale=(1.0, 0.9, 1.0))
    elif mesh_id == "twintail":
        band("hair_cap", r, 0.0, PI * 0.6, base, mat, scale=scale)
        for side in (-1, 1):
            capsule(f"hair_twintail{side}", r * 0.24, r * 1.5,
                    add(x, up, front, side * r * 1.05, -r * 0.35, -r * 0.15), mat,
                    rotation=(0, 0, side * -0.32))
    elif mesh_id == "mohawk":
        band("hair_cap", r, 0.0, PI * 0.45, base, mat, scale=(0.55, 1.02, 1.02))
        box("hair_crest", (r * 0.28, r * 0.85, r * 1.5), add(x, up, front, 0, r * 0.92, -r * 0.05), mat)
    elif mesh_id == "bob":
        band("hair_cap", r * 1.05, 0.0, PI * 0.62, base, mat, scale=scale)
        cylinder("hair_bob", r * 1.12, r * 1.12, r * 0.85,
                 add(x, up, front, 0, -r * 0.42, 0), mat, seg=20)
    elif mesh_id == "afro":
        sphere("hair_afro", r * 1.35, add(x, up, front, 0, r * 0.18, 0), mat,
               scale=(1.0, 0.95, 1.0))
    else:
        band("hair_cap", r, 0.0, PI * 0.56, base, mat, scale=scale)


# ── Râu: 5 mesh id trong FACIAL_HAIR ───────────────────────
def build_facial_hair(base: tuple, mesh_id: str, radius: float, dark_mat, soft_mat) -> None:
    x, up, front = base
    r = radius
    if mesh_id in ("none", "", None):
        return
    if mesh_id == "stubble":
        band("beard_stubble", r * 1.004, PI * 0.6, PI * 0.84, base, soft_mat)
    elif mesh_id == "mustache":
        band("beard_mustache", r * 1.004, PI * 0.46, PI * 0.54, base, dark_mat,
             scale=(0.85, 1.0, 1.02))
    elif mesh_id == "goatee":
        band("beard_mustache", r * 1.006, PI * 0.46, PI * 0.54, base, dark_mat,
             scale=(0.8, 1.0, 1.02))
        box("beard_chin", (r * 0.5, r * 0.75, r * 0.35),
            add(x, up, front, 0, -r * 0.92, r * 0.52), dark_mat, rotation=(0.15, 0, 0))
    elif mesh_id == "beard":
        band("beard_full", r * 1.01, PI * 0.62, PI, base, dark_mat, scale=(1.0, 1.1, 1.03))
        box("beard_jaw", (r * 0.72, r * 0.95, r * 0.42),
            add(x, up, front, 0, -r * 0.98, r * 0.42), dark_mat, rotation=(0.12, 0, 0))


# ── Phụ kiện trên đầu/mặt: 12 mesh id trong ACCESSORIES ────
def build_head_accessory(base: tuple, mesh_id: str, radius: float, sy: float,
                         accent_mat, dark_mat) -> None:
    x, up, front = base
    r = radius
    lens = r * 0.32

    if mesh_id == "glasses":
        for side in (-1, 1):
            torus(f"glasses_lens{side}", lens, r * 0.035,
                  add(x, up, front, side * r * 0.38, r * 0.06, r * 0.92), dark_mat,
                  major_seg=20, minor_seg=8)
            box(f"glasses_temple{side}", (r * 0.05, r * 0.05, r * 0.75),
                add(x, up, front, side * r * 0.72, r * 0.1, r * 0.5), dark_mat)
        box("glasses_bridge", (r * 0.32, r * 0.05, r * 0.05),
            add(x, up, front, 0, r * 0.06, r * 0.92), dark_mat)
    elif mesh_id == "sunglasses":
        shade = material("acc_sunglass", "#0b1220", rough=0.25, metal=0.35)
        for side in (-1, 1):
            sphere(f"sun_lens{side}", r * 0.34,
                   add(x, up, front, side * r * 0.38, r * 0.08, r * 0.86), shade,
                   scale=(1.0, 0.75, 0.45))
        box("sun_bridge", (r * 0.34, r * 0.05, r * 0.05),
            add(x, up, front, 0, r * 0.12, r * 0.9), shade)
    elif mesh_id == "cap":
        band("cap_top", r * 1.06, 0.0, PI * 0.52, add(x, up, front, 0, r * 0.06, 0),
             accent_mat, scale=(1.0, sy * 1.05, 1.05))
        cylinder("cap_brim", r * 1.1, r * 1.1, r * 0.06,
                 add(x, up, front, 0, r * 0.1, r * 0.8), accent_mat,
                 rotation=(0.12, 0, 0), seg=24)
    elif mesh_id == "sunhat":
        straw = material("acc_straw", "#e6d3a3", rough=0.9)
        cylinder("sunhat_brim", r * 2.3, r * 2.3, r * 0.05,
                 add(x, up, front, 0, r * 0.35, 0), straw, seg=32)
        band("sunhat_crown", r * 1.2, 0.0, PI * 0.5,
             add(x, up, front, 0, r * 0.3, 0), straw, scale=(1.0, sy, 1.0))
        cylinder("sunhat_band", r * 1.21, r * 1.21, r * 0.16,
                 add(x, up, front, 0, r * 0.28, 0), accent_mat, seg=24)
    elif mesh_id == "hardhat":
        band("hardhat_dome", r * 1.18, 0.0, PI * 0.46, add(x, up, front, 0, r * 0.06, 0),
             accent_mat, scale=(1.0, sy, 1.06))
        cylinder("hardhat_brim", r * 1.35, r * 1.35, r * 0.05,
                 add(x, up, front, 0, r * 0.08, r * 0.35), accent_mat,
                 rotation=(0.1, 0, 0), seg=28)
    elif mesh_id == "headset":
        torus("headset_band", r * 1.05, r * 0.05, add(x, up, front, 0, r * 0.1, 0), dark_mat,
              rotation=(PI * 0.5, 0, 0), major_seg=24, minor_seg=8)
        for side in (-1, 1):
            cylinder(f"headset_cup{side}", r * 0.26, r * 0.26, r * 0.18,
                     add(x, up, front, side * r * 1.02, 0.0, 0), dark_mat,
                     rotation=(0, PI * 0.5, 0), seg=18)
    elif mesh_id == "earring":
        for side in (-1, 1):
            torus(f"earring{side}", r * 0.14, r * 0.035,
                  add(x, up, front, side * r * 1.0, -r * 0.24, 0), accent_mat,
                  major_seg=18, minor_seg=8)


# ── Phụ kiện trên thân: dây chuyền, khăn quàng, ba lô ────────
def build_body_accessory(P: dict, torso_up: float, mesh_id: str) -> None:
    h, torsoH, torsoD, torsoW = P["h"], P["torsoH"], P["torsoD"], P["torsoW"]
    if mesh_id == "necklace":
        gold = material("acc_necklace", "#f59e0b", rough=0.3, metal=0.8)
        torus("necklace", h * 0.34, h * 0.045,
              (0, torso_up + torsoH - h * 0.05, torsoD * 0.35), gold,
              rotation=(PI / 2.4, 0, 0), major_seg=20, minor_seg=8)
    elif mesh_id == "scarf":
        cloth = material("acc_scarf", "#f59e0b", rough=0.9)
        torus("scarf", h * 0.4, h * 0.14, (0, torso_up + torsoH - h * 0.02, 0), cloth,
              rotation=(PI / 2, 0, 0), major_seg=22, minor_seg=10)
        box("scarf_tail", (h * 0.28, h * 0.9, h * 0.1),
            (h * 0.1, torso_up + torsoH - h * 0.6, torsoD * 0.5), cloth)
    elif mesh_id == "backpack":
        cloth = material("acc_backpack", "#1f2937", rough=0.9)
        strap = material("acc_backpack_strap", "#111827", rough=0.9)
        box("backpack", (torsoW * 1.15, torsoH * 0.62, torsoD * 0.7),
            (0, torso_up + torsoH * 0.6, -torsoD * 0.85), cloth)
        box("backpack_pocket", (torsoW * 0.9, torsoH * 0.16, torsoD * 0.3),
            (0, torso_up + torsoH * 0.45, -torsoD * 0.62), strap)
        for side in (-1, 1):
            box(f"backpack_strap{side}", (h * 0.07, torsoH * 0.7, h * 0.07),
                (side * torsoW * 0.45, torso_up + torsoH * 0.7, -torsoD * 0.5), strap,
                rotation=(0.2, 0, 0))


# ── Dựng toàn bộ mesh; trả về các mốc để tạo rig ────────────
def build_character_mesh(three_d: dict, opts: dict) -> dict:
    p = dict(three_d or {})
    P = proportions(p)
    H, h = P["H"], P["h"]
    legH, torsoH, headR, neckH = P["legH"], P["torsoH"], P["headR"], P["neckH"]
    torsoW, torsoD, shoulderW = P["torsoW"], P["torsoD"], P["shoulderW"]
    sy = min(1.16, max(0.86, 0.88 + (float(p.get("faceRatio") or 1.2) - 1.05) * 0.4))
    jaw = 0.92 + float(p.get("jawWidth") or 0.95) * 0.1
    hair_hex = p.get("hair") or "#1b1b1f"

    mats = {
        "skin": material("skin", p.get("skin"), rough=0.72),
        "shade": material("skin_shade", p.get("skinShade") or p.get("skin"), rough=0.72),
        "hair": material("hair", hair_hex, rough=0.55),
        "beard_soft": material("beard_soft", darken(hair_hex, 0.55), rough=0.9, alpha=0.45),
        "top": material("cloth_top", p.get("top"), rough=0.9),
        "bottom": material("cloth_bottom", p.get("bottom"), rough=0.9),
        "shoes": material("shoes", p.get("shoes"), rough=0.95),
        "eye": material("eye", p.get("eye"), rough=0.25),
        "white": material("eye_white", "#f7f7f7", rough=0.4),
        "accent": material("accent", p.get("accent"), rough=0.35, metal=0.6),
        "dark": material("dark", "#1f2937", rough=0.4, metal=0.2),
        "lips": material("lips", "#a35b5b", rough=0.6),
    }
    beard_dark = material("beard", darken(hair_hex, 0.55), rough=0.9)

    # ── CHÂN ────────────────────────────────────────────────
    thigh_len = legH * 0.49
    shoe_h = h * 0.2
    shin_len = legH - thigh_len - shoe_h        # đế giày chạm đúng y = 0
    for side in (-1, 1):
        lx = side * P["hipW"] * 0.28
        capsule(f"thigh.{side}", P["thighR"], max(0.01, thigh_len - P["thighR"] * 2),
                (lx, legH - thigh_len / 2, 0), mats["bottom"])
        capsule(f"shin.{side}", P["shinR"], max(0.01, shin_len - P["shinR"] * 2),
                (lx, legH - thigh_len - shin_len / 2, 0), mats["bottom"])
        box(f"shoe.{side}", (P["shinR"] * 1.8, shoe_h, P["footL"]),
            (lx, legH - thigh_len - shin_len - shoe_h / 2, P["footL"] * 0.3), mats["shoes"])

    # ── THÂN ────────────────────────────────────────────────
    capsule("hip", P["hipW"] * 0.5, h * 0.45, (0, legH + h * 0.18, 0), mats["bottom"])
    shirt_h = torsoH * 0.86
    capsule("chest", torsoW * 0.5, max(0.01, shirt_h - torsoW),
            (0, legH + torsoH * 0.55, 0), mats["top"], seg=18,
            scale=(1.0, 1.0, torsoD / torsoW))
    box("shoulders", (shoulderW * 0.82, h * 0.07, torsoD * 0.35),
        (0, legH + torsoH * 0.94, torsoD * 0.32), mats["top"], rotation=(0.12, 0, 0))
    cylinder("neck", h * 0.2, h * 0.24, neckH * 1.5,
             (0, legH + torsoH + neckH * 0.4, 0), mats["shade"])

    # ── ĐẦU ─────────────────────────────────────────────────
    head_up = legH + torsoH + neckH * 1.1
    skull_up = head_up + headR * sy
    sphere("skull", headR, (0, skull_up, 0), mats["skin"], scale=(jaw, sy, 0.95))
    for side in (-1, 1):
        sphere(f"ear{side}", headR * 0.16, (side * headR * 0.99, skull_up, 0),
               mats["shade"], scale=(0.4, 1.0, 0.8))
        sphere(f"eye_white{side}", headR * 0.17,
               (side * headR * 0.34, skull_up + headR * 0.1, headR * 0.84), mats["white"],
               scale=(1.0, 0.75, 0.5))
        sphere(f"iris{side}", headR * 0.12,
               (side * headR * 0.34, skull_up + headR * 0.1, headR * 0.92), mats["eye"],
               scale=(1.0, 0.85, 0.6))
        box(f"brow{side}", (headR * 0.3, headR * 0.05, headR * 0.06),
            (side * headR * 0.34, skull_up + headR * 0.32, headR * 0.86), mats["hair"],
            rotation=(0, 0, side * -0.12))
    sphere("nose", headR * 0.09, (0, skull_up - headR * 0.08, headR * 0.98), mats["shade"],
           scale=(1.0, 1.0, 0.8))
    sphere("lips", headR * 0.13, (0, skull_up - headR * 0.4, headR * 0.9), mats["lips"],
           scale=(1.15, 0.3, 0.5))

    skull_base = (0.0, skull_up, 0.0)
    build_hair(skull_base, str(p.get("hairMesh") or "short"), headR, sy, mats["hair"])
    build_facial_hair(skull_base, str(p.get("facialHairMesh") or "none"), headR,
                      beard_dark, mats["beard_soft"])
    build_head_accessory(skull_base, str(p.get("accessoryMesh") or "none"), headR, sy,
                         mats["accent"], mats["dark"])

    # ── TAY ─────────────────────────────────────────────────
    arm_pivot_up = legH + torsoH * 0.9
    arm_x = shoulderW * 0.46
    for side in (-1, 1):
        ax = side * arm_x
        sphere(f"shoulder.{side}", P["upperArmR"] * 1.3, (ax, arm_pivot_up, 0), mats["top"])
        capsule(f"upperarm.{side}", P["upperArmR"],
                max(0.01, P["upperArmL"] - P["upperArmR"] * 2),
                (ax, arm_pivot_up - P["upperArmL"] / 2, 0), mats["top"])
        elbow_up = arm_pivot_up - P["upperArmL"]
        capsule(f"forearm.{side}", P["foreArmR"],
                max(0.01, P["foreArmL"] - P["foreArmR"] * 2),
                (ax, elbow_up - P["foreArmL"] / 2, 0), mats["skin"])
        box(f"hand.{side}", (P["foreArmR"] * 2, P["foreArmL"] * 0.32, P["foreArmR"] * 1.3),
            (ax, elbow_up - P["foreArmL"] * 1.06, 0), mats["shade"], rotation=(0.12, 0, 0))
        if str(p.get("accessoryMesh")) == "watch" and side > 0:
            cylinder(f"watch.{side}", P["foreArmR"] * 1.12, P["foreArmR"] * 1.12, h * 0.045,
                     (ax, elbow_up - P["foreArmL"] * 0.92, 0), mats["accent"],
                     rotation=(0, PI * 0.5, 0), seg=18)

    build_body_accessory(P, legH, str(p.get("accessoryMesh") or "none"))

    return {
        "P": P,
        "H": H,
        "legH": legH,
        "torsoH": torsoH,
        "headR": headR,
        "neckH": neckH,
        "head_up": head_up,
        "skull_up": skull_up,
        "thigh_len": thigh_len,
        "shin_len": shin_len,
        "arm_pivot_up": arm_pivot_up,
        "arm_x": arm_x,
    }


# ── Nối tất cả phần thành 1 mesh (giống "join" khi dựng tay trong Blender) ──
def join_parts(name: str = "body"):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in PARTS:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    if len(PARTS) > 1:
        bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = name
    body.data.name = name
    return body


# ── Rig: 19 xương, đặt tên theo nhóm của figure.js (Hips/Spine/Chest/...) ──
def bone_specs(M: dict) -> list:
    P = M["P"]
    legH, torsoH = M["legH"], M["torsoH"]
    neckH, headR = M["neckH"], M["headR"]
    arm_up, arm_x = M["arm_pivot_up"], M["arm_x"]
    upper_len, fore_len = P["upperArmL"], P["foreArmL"]
    ankle = legH - M["thigh_len"] - M["shin_len"]
    hip_x = P["hipW"] * 0.28

    spine_top = legH + torsoH * 0.30
    chest_top = legH + torsoH * 0.68
    neck_top = M["head_up"] + neckH * 0.5
    head_top = M["skull_up"] + headR * 1.15

    spec = [
        ("Hips", (0, legH, 0), (0, spine_top, 0), None),
        ("Spine", (0, spine_top, 0), (0, chest_top, 0), "Hips"),
        ("Chest", (0, chest_top, 0), (0, legH + torsoH + neckH * 0.2, 0), "Spine"),
        ("Neck", (0, legH + torsoH + neckH * 0.2, 0), (0, neck_top, 0), "Chest"),
        ("Head", (0, neck_top, 0), (0, head_top, 0), "Neck"),
    ]
    for side, tag in ((-1, "L"), (1, "R")):
        sx = side * arm_x
        spec += [
            (f"Shoulder.{tag}", (side * arm_x * 0.3, arm_up, 0),
             (sx, arm_up + P["upperArmR"] * 0.5, 0), "Chest"),
            (f"UpperArm.{tag}", (sx, arm_up, 0), (sx, arm_up - upper_len, 0), f"Shoulder.{tag}"),
            (f"Forearm.{tag}", (sx, arm_up - upper_len, 0),
             (sx, arm_up - upper_len - fore_len, 0), f"UpperArm.{tag}"),
            (f"Hand.{tag}", (sx, arm_up - upper_len - fore_len, 0),
             (sx, arm_up - upper_len - fore_len - P["h"] * 0.35, 0), f"Forearm.{tag}"),
            (f"Thigh.{tag}", (side * hip_x, legH, 0), (side * hip_x, legH - M["thigh_len"], 0), "Hips"),
            (f"Shin.{tag}", (side * hip_x, legH - M["thigh_len"], 0),
             (side * hip_x, ankle, 0), f"Thigh.{tag}"),
            (f"Foot.{tag}", (side * hip_x, ankle, 0),
             (side * hip_x, ankle - P["h"] * 0.02, P["footL"] * 0.55), f"Shin.{tag}"),
        ]
    return spec


def build_rig(M: dict):
    """Tạo armature tên `rig` với các xương đặt theo tỉ lệ cơ thể."""
    arm_data = bpy.data.armatures.new("rig")
    rig = bpy.data.objects.new("rig", arm_data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    created = {}
    for name, head3, tail3, parent in bone_specs(M):
        bone = arm_data.edit_bones.new(name)
        bone.head = loc(*head3)
        bone.tail = loc(*tail3)
        bone.use_connect = False
        if parent:
            bone.parent = created[parent]
        created[name] = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


# ── Skin: automatic weights -> envelope -> gán theo xương gần nhất ──
def _has_weights(body) -> bool:
    """Mesh đã THỰC SỰ có trọng số chưa.

    Bone Heat có thể thất bại "im lặng": Blender chỉ in cảnh báo
    (`Bone Heat Weighting: failed to find solution for one or more bones`),
    `parent_set` vẫn trả về bình thường nhưng mesh không có vertex group nào —
    hậu quả là GLB xuất ra **mất luôn skin** (đã từng xảy ra, xem api/selftest.py
    nhóm 8). Vì vậy phải kiểm tra lại chứ không tin mã trả về.
    """
    if not body.vertex_groups:
        return False
    for vert in body.data.vertices:
        if vert.groups:
            return True
    return False


def _point_segment_distance(point, head, tail) -> float:
    """Khoảng cách từ điểm tới đoạn thẳng (để tìm xương gần nhất)."""
    segment = tail - head
    length_sq = segment.length_squared
    if length_sq < 1e-9:
        return (point - head).length
    t = max(0.0, min(1.0, (point - head).dot(segment) / length_sq))
    return (point - (head + segment * t)).length


def _clear_skin(body) -> None:
    """Gỡ modifier/parent/nhóm cũ trước khi thử phương án khác."""
    for modifier in list(body.modifiers):
        if modifier.type == "ARMATURE":
            body.modifiers.remove(modifier)
    body.vertex_groups.clear()
    body.parent = None


def nearest_bone_weights(body, rig) -> None:
    """Gán trọng số theo xương gần nhất — phương án luôn chạy được.

    Tất định (không phụ thuộc giải thuật heat weighting): mỗi đỉnh gán cho
    xương gần nhất; nếu xương gần thứ hai chỉ xa hơn < 35% thì pha thêm 35%
    để khớp cử động mềm hơn.
    """
    bones = [
        (bone.name, rig.matrix_world @ bone.head_local, rig.matrix_world @ bone.tail_local)
        for bone in rig.data.bones
    ]
    body.vertex_groups.clear()
    groups = {name: body.vertex_groups.new(name=name) for name, _, _ in bones}

    for vert in body.data.vertices:
        point = body.matrix_world @ vert.co
        ranked = sorted((_point_segment_distance(point, head, tail), name)
                        for name, head, tail in bones)
        nearest = ranked[0]
        groups[nearest[1]].add([vert.index], 1.0, "REPLACE")
        if len(ranked) > 1 and nearest[0] > 1e-6 and ranked[1][0] < nearest[0] * 1.35:
            groups[nearest[1]].add([vert.index], 0.65, "REPLACE")
            groups[ranked[1][1]].add([vert.index], 0.35, "ADD")

    body.parent = rig
    body.matrix_parent_inverse = rig.matrix_world.inverted()
    modifier = body.modifiers.new("Armature", "ARMATURE")
    modifier.object = rig


def skin(body, rig) -> str:
    """Gắn xương cho mesh; trả về tên phương án đã dùng (ghi vào log/kết quả)."""
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig

    for mode in ("ARMATURE_AUTO", "ARMATURE_ENVELOPE"):
        try:
            bpy.ops.object.parent_set(type=mode)
        except RuntimeError as exc:
            print(f"[mma] {mode} loi ({exc}) -> thu cach khac")
            _clear_skin(body)
            continue
        if _has_weights(body):
            return "auto-weights" if mode == "ARMATURE_AUTO" else "envelope"
        print(f"[mma] {mode} khong tao duoc trong so -> thu cach khac")
        _clear_skin(body)

    nearest_bone_weights(body, rig)
    return "nearest-bone"


def cleanup_mesh(body) -> None:
    """Làm sạch dữ liệu mesh sau khi join.

    Mesh ghép từ nhiều khối rời có thể chứa mặt trùng/hướng sai ⇒ glTF exporter
    cảnh báo `Mesh ... is not valid, and may be exported wrongly`. Ở đây chỉ làm
    hai việc an toàn: tính lại hướng pháp tuyến và để Blender tự sửa dữ liệu hỏng
    (`Mesh.validate`), KHÔNG weld các phần rời lại (sẽ làm mất chi tiết).
    """
    mesh = body.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(mesh)
    bm.free()
    mesh.validate(verbose=False)
    mesh.update()


def dump_parts() -> None:
    """In hộp bao TỪNG phần — để chẩn đoán khi có chi tiết nằm sai chỗ.

    Bật bằng `options.dump_parts = true`; dòng `__MMA_PARTS__[...]` xuất hiện
    trong stdout để backend/log đọc được. Toạ độ đã đổi về hệ three.js
    (up = trục Y, depth = trục Z hướng ra trước).
    """
    rows = []
    for obj in PARTS:
        coords = [obj.matrix_world @ vert.co for vert in obj.data.vertices]
        rows.append({
            "name": obj.name,
            "sideX": [round(min(c.x for c in coords), 4), round(max(c.x for c in coords), 4)],
            "up": [round(min(c.z for c in coords), 4), round(max(c.z for c in coords), 4)],
            "depth": [round(min(-c.y for c in coords), 4), round(max(-c.y for c in coords), 4)],
        })
    print("__MMA_PARTS__" + json.dumps(rows, ensure_ascii=False))


def flatten_shading(body) -> None:
    """Tắt shading mượt (khi options.smooth = false)."""
    for poly in body.data.polygons:
        poly.use_smooth = False


# ── Xuất GLB: chỉ truyền tham số mà bản Blender đang chạy có hỗ trợ ──
def export_glb(path: str, *, selection_only: bool = False) -> None:
    """Xuất scene (hoặc chỉ vật thể đang chọn) ra GLB.

    Addon dùng `selection_only=True` để không lẫn vật thể khác trong scene
    người dùng (ví dụ Cube mặc định của Blender).
    """
    wanted = {
        "filepath": path,
        "export_format": "GLB",
        "use_selection": bool(selection_only),
        "export_apply": False,        # KHÔNG apply modifier (giữ armature sống)
        "export_yup": True,           # Z-up (Blender) -> Y-up (glTF/three.js)
        "export_skins": True,
        "export_animations": False,
    }
    props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    kwargs = {k: v for k, v in wanted.items() if k in props}
    kwargs["filepath"] = path
    kwargs["export_format"] = "GLB"
    bpy.ops.export_scene.gltf(**kwargs)


def parse_args() -> tuple:
    argv = list(sys.argv)
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    if len(args) < 2:
        raise SystemExit(
            "Dùng: blender -b --python build_character.py -- <spec.json> <out.glb> [options.json]"
        )
    opts = {}
    if len(args) > 2 and os.path.exists(args[2]):
        raw = open(args[2], encoding="utf-8").read().strip()
        opts = json.loads(raw) if raw else {}
    with open(args[0], encoding="utf-8") as handle:
        spec = json.loads(handle.read())
    if not isinstance(spec, dict) or not spec.get("threeD"):
        raise SystemExit("spec.json thiếu 'threeD' — không dựng được nhân vật.")
    return spec, args[1], opts


def main() -> int:
    spec, out_path, opts = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)   # scene trống, không cube/đèn
    M = build_character_mesh(spec.get("threeD") or {}, opts)
    if opts.get("dump_parts"):
        dump_parts()

    keep_parts = bool(opts.get("keep_parts"))
    if keep_parts:
        body = None
        mode = "none (keep_parts: từng phần rời)"
    else:
        body = join_parts("body")
        cleanup_mesh(body)
        if not opts.get("smooth", True):
            flatten_shading(body)
        mode = skin(body, build_rig(M)) if opts.get("rig", True) else "none"

    export_glb(out_path)
    parent = body.parent if body is not None else None
    result = {
        "parts": len(PARTS),
        "objects": len(PARTS) if keep_parts else 1,
        "vertices": (len(body.data.vertices) if body is not None
                     else sum(len(obj.data.vertices) for obj in PARTS)),
        "polygons": (len(body.data.polygons) if body is not None
                     else sum(len(obj.data.polygons) for obj in PARTS)),
        "bones": len(parent.data.bones) if parent is not None and parent.type == "ARMATURE" else 0,
        "skin": mode,
        "heightM": round(M["H"], 3),
        "out": os.path.basename(out_path),
    }
    print("__MMA_RESULT__" + json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception:                   # in traceback để backend đọc được log
        traceback.print_exc()
        sys.exit(1)

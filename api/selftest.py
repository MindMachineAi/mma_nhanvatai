"""
selftest.py — Bộ kiểm thử backend (bước 5 & 6), chạy KHÔNG cần trình duyệt,
không cần pytest: chỉ Python + `assert` viết tay, giống `tools/selftest.mjs`,
`tools/selftest3d.mjs`, `web/tools/smoke-ui.jsx` của repo.

Chạy:
    python api/selftest.py              # đầy đủ: gồm dựng GLB THẬT bằng Blender
    python api/selftest.py --fast       # bỏ phần Blender (nhanh, vài giây)
    python api/selftest.py --sweep      # dựng thêm 2 nhân vật khác kiểu tóc/phụ kiện

Bộ test **không gọi mạng**: các provider AI được kiểm ở nhánh lỗi/cấu hình
(dùng `Settings` tạm), còn DeepSeek được kiểm ở nhánh "chưa có key". Nhờ vậy
kết quả tất định và không tốn lượt gọi API.
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys
import traceback
from pathlib import Path

API_DIR = Path(__file__).resolve().parent
ROOT_DIR = API_DIR.parent
sys.path.insert(0, str(API_DIR))                     # để `import main`, `import config`

# Console Windows mặc định là cp1252 -> ép UTF-8 để in được tiếng Việt và khung ═══
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

# Thư viện riêng cho test: KHÔNG đụng `api/data/library.json` thật.
TMP_DIR = API_DIR / "data" / "tmp"
TMP_DIR.mkdir(parents=True, exist_ok=True)
os.environ["LIBRARY_DIR"] = str(TMP_DIR / "selftest_library.json")

from fastapi.testclient import TestClient           # noqa: E402  (cần sau khi set env)

from config import Settings, settings             # noqa: E402
from engines import ai_portrait, blender as blender_engine, llm as llm_engine  # noqa: E402
from engines.ai_portrait import AiPortraitError     # noqa: E402
from engines.blender import BlenderError            # noqa: E402
from engines.llm import DeepSeekLLM, LlmError, spec_summary  # noqa: E402
from engines import portrait_png                    # noqa: E402
from library_store import LibraryError, LibraryStore  # noqa: E402
from main import app                                # noqa: E402
from tools import glb_info                          # noqa: E402

client = TestClient(app)

# ── Bộ đếm & in kết quả ────────────────────────────────────
PASS = 0
FAIL = 0
FAILED: list[str] = []


class CheckFailed(Exception):
    """Một kiểm tra hỏng — dừng nhóm hiện tại nhưng đi tiếp nhóm sau."""


def section(title: str) -> None:
    print(f"\n── {title} " + "─" * max(0, 58 - len(title)))


def expect(condition, message: str) -> None:
    """Đếm 1 kiểm tra; hỏng thì ném `CheckFailed` kèm mô tả tiếng Việt."""
    global PASS, FAIL
    if condition:
        PASS += 1
        return
    FAIL += 1
    FAILED.append(message)
    print(f"    ✗ {message}")
    raise CheckFailed(message)


def run(label: str, fn) -> None:
    """Chạy 1 nhóm kiểm tra và in dòng tổng kết cho nhóm đó."""
    global FAIL
    before = PASS
    try:
        fn()
    except CheckFailed:
        print(f"  ✗ {label} — dừng ở kiểm tra hỏng đầu tiên "
              f"({PASS - before} kiểm tra đã đạt trước đó)")
    except Exception as exc:                        # noqa: BLE001 - test phải bắt hết
        FAIL += 1
        FAILED.append(f"{label}: {exc.__class__.__name__}: {exc}")
        print(f"  ✗ {label} — {exc.__class__.__name__}: {exc}")
        print("    " + traceback.format_exc(limit=6).replace("\n", "\n    "))
    else:
        print(f"  ✓ {label} — {PASS - before} kiểm tra")


# ── Fixture: character card tối thiểu nhưng đủ trường của engine ──
DEMO_SPEC = {
    "schema": 1,
    "seed": "NV-SELFTEST",
    "style": "realistic",
    "id": "nv-tran-bao-long-selftest",
    "identity": {
        "fullName": "Trần Bảo Long",
        "callName": "Long",
        "gender": "nam",
        "genderLabel": "Nam",
        "age": 31,
        "occupation": "ky_su_bim",
        "occupationLabel": "Kỹ sư BIM",
        "hometown": "Hà Nội",
        "nationality": "Việt Nam",
    },
    "appearance": {
        "heightCm": 178,
        "build": "the_thao",
        "skinTone": "trung_binh",
        "faceShape": "vuong",
        "hairStyle": "ngan_ru",
        "hairColor": "den",
        "facialHair": "rau_de",
        "eyeColor": "nau",
    },
    "accessory": "mu_bao_ho",
    "outfit": {
        "style": "safety",
        "label": "Bảo hộ lao động",
        "top": "Áo phản quang",
        "bottom": "Quần BHLĐ",
        "shoes": "Ủng bảo hộ",
        "palette": {"primary": "#f97316", "secondary": "#111827", "accent": "#f59e0b"},
    },
    "personality": {"archetype": "nguoi_dan_duong", "traits": ["tỉ mỉ", "logic"]},
    "prompt": "Portrait of a Vietnamese site engineer in hi-vis vest and hard hat, 3/4 view, studio light",
    "threeD": {
        "heightM": 1.78,
        "gender": "nam",
        "age": 31,
        "ageFactor": 0.4,
        "build": "the_thao",
        "mass": 1.06,
        "width": 1.1,
        "faceRatio": 1.2,
        "jawWidth": 1.12,
        "skin": "#d9a273",
        "skinShade": "#b9814f",
        "hair": "#1b1b1f",
        "hairMesh": "side",
        "facialHairMesh": "goatee",
        "eye": "#5b3a1e",
        "top": "#f97316",
        "bottom": "#111827",
        "shoes": "#0f766e",
        "accent": "#f59e0b",
        "accessoryMesh": "hardhat",
        "outfitStyle": "safety",
    },
}

# Nhân vật thứ 2/3 cho --sweep: kiểu tóc dài + phụ kiện khác, nữ, phong cách anime.
SWEEP_SPECS = [
    {
        **DEMO_SPEC,
        "id": "nv-sweep-b",
        "seed": "NV-SWEEP-B",
        "style": "anime",
        "identity": {**DEMO_SPEC["identity"], "fullName": "Lê Thu Hà", "gender": "nu", "genderLabel": "Nữ"},
        "accessory": "day_chuyen",
        "threeD": {
            **DEMO_SPEC["threeD"],
            "gender": "nu",
            "heightM": 1.62,
            "mass": 0.86,
            "width": 0.95,
            "hair": "#4a3b6b",
            "hairMesh": "ponytail",
            "facialHairMesh": "none",
            "accessoryMesh": "necklace",
            "top": "#7e22ce",
        },
    },
    {
        **DEMO_SPEC,
        "id": "nv-sweep-c",
        "seed": "NV-SWEEP-C",
        "style": "cartoon",
        "identity": {**DEMO_SPEC["identity"], "fullName": "Phạm Gia Bảo", "gender": "phi_nhi"},
        "accessory": "ba_lo",
        "threeD": {
            **DEMO_SPEC["threeD"],
            "gender": "phi_nhi",
            "heightM": 1.7,
            "mass": 1.34,
            "width": 1.18,
            "hair": "#9aa0a6",
            "hairMesh": "curly",
            "facialHairMesh": "beard",
            "accessoryMesh": "backpack",
            "top": "#111827",
        },
    },
]


def spec_payload(spec: dict | None = None) -> dict:
    return {"spec": json.loads(json.dumps(spec or DEMO_SPEC))}


# ── 1. Đèn báo & thông tin dịch vụ ─────────────────────────
def test_health() -> None:
    section("1. Đèn báo API (/health, /)")
    res = client.get("/health")
    expect(res.status_code == 200, f"HTTP {res.status_code}")
    body = res.json()
    expect(body.get("status") == "ok", "thiếu status=ok")
    expect("version" in body, "thiếu version")
    expect(isinstance(body.get("uptimeSec"), (int, float)), "thiếu uptimeSec")

    res = client.get("/")
    expect(res.status_code == 200, f"HTTP {res.status_code}")
    body = res.json()
    expect(len(body.get("endpoints", [])) == 9, "phải liệt kê đủ 9 endpoint")


def test_engines() -> None:
    section("2. /api/engines (Blender + khoá AI)")
    res = client.get("/api/engines")
    expect(res.status_code == 200, f"HTTP {res.status_code}")
    body = res.json()
    for key in ("blender", "llm", "ai", "library"):
        expect(key in body, f"thiếu khoá {key}")
    expect(isinstance(body["blender"].get("ready"), bool), "blender.ready phải là bool")
    expect(body["llm"].get("provider") == "deepseek", "llm.provider phải là deepseek")
    expect(isinstance(body["ai"].get("order"), list), "ai.order phải là list")
    expect(body["library"].get("path"), "thiếu library.path")


# ── 3. Kiểm tra dữ liệu vào ────────────────────────────────
def test_validation() -> None:
    section("3. Kiểm tra spec đầu vào (thông báo tiếng Việt)")
    res = client.post("/api/portrait.png", json={})
    expect(res.status_code == 422, f"thiếu spec phải là 422, nhận {res.status_code}")
    expect("spec" in res.json().get("detail", ""), "detail phải nhắc tới 'spec'")

    res = client.post("/api/portrait.png", json={"spec": {"identity": {}}})
    expect(res.status_code == 422, f"spec rỗng phải là 422, nhận {res.status_code}")
    expect("fullName" in res.json().get("detail", ""), "detail phải nhắc fullName")

    res = client.post("/api/glb", json={"spec": "khong-phai-object"})
    expect(res.status_code == 422, f"glb sai kiểu phải là 422, nhận {res.status_code}")


# ── 4. Chân dung PNG (Pillow, offline) ─────────────────────
def test_portrait_png() -> None:
    section("4. /api/portrait.png (Pillow, không cần mạng)")
    res = client.post("/api/portrait.png", json={**spec_payload(), "size": 256})
    expect(res.status_code == 200, f"HTTP {res.status_code}")
    expect(res.headers["content-type"].startswith("image/png"), "content-type phải là PNG")
    expect(res.content[:8] == b"\x89PNG\r\n\x1a\n", "thiếu magic bytes PNG")
    expect(res.headers.get("X-Portrait-Size") == "256", "X-Portrait-Size phải = 256")
    width, height = struct.unpack(">II", res.content[16:24])
    expect(width == 256, f"chiều rộng phải 256, nhận {width}")
    expect(abs(height - round(256 * 320 / 420)) <= 1, f"chiều cao lệch: {height}")

    # size quá lớn bị kẹp trần 2048, size rác -> mặc định 1024
    res_big = client.post("/api/portrait.png", json={**spec_payload(), "size": 9999})
    expect(res_big.headers.get("X-Portrait-Size") == "2048", "phải kẹp trần 2048")
    res_junk = client.post("/api/portrait.png", json={**spec_payload(), "size": "abc"})
    expect(res_junk.headers.get("X-Portrait-Size") == "1024", "size rác phải về mặc định")

    # Tất định: cùng spec -> cùng bytes (giống triết lý "cùng seed, cùng nhân vật")
    first = portrait_png.render(DEMO_SPEC, size=384, caption="Trần Bảo Long")
    second = portrait_png.render(DEMO_SPEC, size=384, caption="Trần Bảo Long")
    expect(first == second, "PNG phải tất định với cùng đầu vào")
    expect(len(first) > 3000, f"PNG quá nhỏ, có thể lỗi vẽ: {len(first)} bytes")

    # Mọi phong cách ảnh + mọi kiểu tóc đều vẽ được, không ném lỗi
    for style in ("realistic", "cartoon", "anime", "cinematic"):
        for hair_mesh in ("bald", "buzz", "short", "side", "curly", "long",
                          "ponytail", "bun", "twintail", "mohawk", "bob", "afro"):
            variant = json.loads(json.dumps(DEMO_SPEC))
            variant["style"] = style
            variant["threeD"]["hairMesh"] = hair_mesh
            data = portrait_png.render(variant, size=192)
            expect(data[:8] == b"\x89PNG\r\n\x1a\n", f"PNG hỏng: {style}/{hair_mesh}")


def test_portrait_accessories() -> None:
    section("5. PNG cho đủ 12 phụ kiện + 5 kiểu râu")
    accessories = ("none", "glasses", "sunglasses", "cap", "sunhat", "hardhat",
                   "headset", "earring", "necklace", "scarf", "backpack", "watch")
    beards = ("none", "stubble", "mustache", "goatee", "beard")
    for accessory in accessories:
        for beard in beards:
            variant = json.loads(json.dumps(DEMO_SPEC))
            variant["threeD"]["accessoryMesh"] = accessory
            variant["threeD"]["facialHairMesh"] = beard
            data = portrait_png.render(variant, size=128, caption="")
            expect(data[:8] == b"\x89PNG\r\n\x1a\n", f"PNG hỏng: {accessory}/{beard}")


# ── 6. Thư viện nhân vật trên server ───────────────────────
def test_library() -> None:
    section("6. Thư viện server (GET / POST / DELETE)")
    lib_path = Path(os.environ["LIBRARY_DIR"])
    lib_path.unlink(missing_ok=True)

    res = client.get("/api/library")
    expect(res.status_code == 200, f"HTTP {res.status_code}")
    expect(res.json() == [], "thư viện mới phải rỗng")

    res = client.post("/api/library", json=spec_payload())
    expect(res.status_code == 200, f"HTTP {res.status_code}: {res.text[:160]}")
    record = res.json()
    expect(record.get("id") == DEMO_SPEC["id"], "id phải giữ nguyên của spec")
    expect(bool(record.get("savedAt")), "bản ghi phải có savedAt")

    items = client.get("/api/library").json()
    expect(len(items) == 1, f"phải có đúng 1 bản ghi, nhận {len(items)}")
    expect(items[0]["identity"]["fullName"] == "Trần Bảo Long", "sai nội dung đã lưu")

    client.post("/api/library", json=spec_payload())
    expect(len(client.get("/api/library").json()) == 1, "lưu trùng id phải là CẬP NHẬT")

    client.post("/api/library", json=spec_payload(SWEEP_SPECS[0]))
    items = client.get("/api/library").json()
    expect(len(items) == 2, f"phải có 2 bản ghi, nhận {len(items)}")
    expect(items[0]["id"] == SWEEP_SPECS[0]["id"], "bản ghi mới nhất phải nằm đầu danh sách")

    res = client.delete(f"/api/library/{DEMO_SPEC['id']}")
    expect(res.status_code == 200, f"HTTP DELETE {res.status_code}")
    expect(res.json().get("deleted") is True, "xoá phải trả deleted=true")
    expect(len(client.get("/api/library").json()) == 1, "xoá xong phải còn 1 bản ghi")

    res = client.delete(f"/api/library/{DEMO_SPEC['id']}")
    expect(res.status_code == 404, f"xoá id không tồn tại phải là 404, nhận {res.status_code}")
    expect("Không có nhân vật" in res.json().get("detail", ""),
           "detail phải nói rõ không tìm thấy")

    # File JSON hỏng -> LibraryError tiếng Việt, không phải traceback lạ
    lib_path.write_text("{ khong-phai-json", encoding="utf-8")
    try:
        LibraryStore(lib_path).load()
        raise CheckFailed("file thư viện hỏng phải ném LibraryError")
    except LibraryError as exc:
        expect("hỏng" in str(exc), f"thông báo phải nói file hỏng: {exc}")

    # Bản ghi thiếu identity.fullName -> bị từ chối
    lib_path.write_text(json.dumps([{"id": "x"}]), encoding="utf-8")
    try:
        LibraryStore(lib_path).save({"seed": "abc"})
        raise CheckFailed("spec thiếu fullName phải bị từ chối")
    except LibraryError as exc:
        expect("fullName" in str(exc), f"thông báo phải nhắc fullName: {exc}")
    lib_path.unlink(missing_ok=True)


# ── 7. Engine ở nhánh "chưa cấu hình" (không gọi mạng) ─────
def test_engines_unit() -> None:
    section("7. Engine: Blender/AI/DeepSeek khi chưa cấu hình")
    bare = Settings(
        blender_path=None,
        deepseek_api_key="",
        gemini_api_key="",
        metoken_api_key="",
        portrait_allow_pollinations=False,
        library_path=TMP_DIR / "bare-library.json",
    )
    expect(bare.blender_ready is False, "blender_ready phải False khi không có đường dẫn")
    expect(bare.ai_providers() == [], "tắt hết provider thì danh sách phải rỗng")
    expect(bare.llm_ready is False, "llm_ready phải False khi không có key")

    engine = blender_engine.BlenderEngine(bare)
    expect(engine.info()["ready"] is False, "info().ready phải là False")
    try:
        engine.build_glb(DEMO_SPEC)
        raise CheckFailed("thiếu Blender phải ném BlenderError")
    except BlenderError as exc:
        expect("BLENDER_PATH" in str(exc), f"thông báo phải chỉ cách sửa: {exc}")

    try:
        ai_portrait.generate(DEMO_SPEC, cfg=bare)
        raise CheckFailed("không có provider phải ném AiPortraitError")
    except AiPortraitError as exc:
        text = str(exc)
        expect("GEMINI_API_KEY" in text or "PORTRAIT_ALLOW_POLLINATIONS" in text,
               f"thông báo phải chỉ cách bật provider: {exc}")
    expect(ai_portrait.info(bare)["order"] == [], "info(bare).order phải rỗng")

    prompt, source = ai_portrait.build_prompt(DEMO_SPEC, cfg=bare)
    expect(source == "character-engine", f"nguồn prompt phải là character-engine, nhận {source}")
    expect(prompt == DEMO_SPEC["prompt"], "không có DeepSeek thì prompt lấy nguyên từ spec")

    prompt2, source2 = ai_portrait.build_prompt(
        {"identity": {"fullName": "Nguyễn Văn A"}}, cfg=bare)
    expect(source2 == "fallback", f"card thiếu prompt phải dùng bản dự phòng, nhận {source2}")
    expect("Nguyễn Văn A" in prompt2, "prompt dự phòng phải có tên nhân vật")

    seed_a = ai_portrait.seed_int(DEMO_SPEC)
    expect(seed_a == ai_portrait.seed_int(dict(DEMO_SPEC)) and seed_a > 0,
           "seed ảnh phải tất định theo nhân vật")
    expect(ai_portrait.seed_int({"seed": "khac"}) != seed_a, "seed khác phải ra số khác")

    llm_bare = DeepSeekLLM(bare)
    expect(llm_bare.refine_image_prompt(DEMO_SPEC) is None,
           "chưa có key thì refine_image_prompt phải trả None để tự lùi về spec.prompt")
    try:
        llm_bare.enrich_card(DEMO_SPEC)
        raise CheckFailed("chưa có key phải ném LlmError")
    except LlmError as exc:
        expect("DEEPSEEK_API_KEY" in str(exc), f"thông báo phải nhắc DEEPSEEK_API_KEY: {exc}")
    info = llm_bare.info()
    expect(info["ready"] is False and "deepseek" in info["baseUrl"], "info() của DeepSeek sai")

    summary = spec_summary(DEMO_SPEC)
    expect("Trần Bảo Long" in summary, "spec_summary phải có tên nhân vật")
    expect("Kỹ sư BIM" in summary, "spec_summary phải có nghề nghiệp")
    expect(DEMO_SPEC["prompt"] in summary, "spec_summary phải kèm prompt gốc để LLM viết lại")

    # Web luôn nhận lỗi { detail: "tiếng Việt" } — kiểm bằng chính endpoint
    if not settings.llm_ready:              # chỉ chạy khi máy chưa có key (không gọi mạng)
        res = client.post("/api/ai/character", json=spec_payload())
        expect(res.status_code == 400, f"chưa có key phải là 400, nhận {res.status_code}")
        expect("DEEPSEEK_API_KEY" in res.json().get("detail", ""),
               "detail phải nhắc DEEPSEEK_API_KEY")


# ── 8. Blender headless: dựng GLB có rig thật ──────────────
def expected_body_height(three_d: dict) -> float:
    """Chiều cao thân (chưa kể tóc/mũ) theo đúng công thức của figure.js.

    legH + torsoH + neckH*1.1 + 2*headR*sy = 0.77H + (H/7.4)*(0.308 + sy)
    """
    height_m = float(three_d.get("heightM") or 1.7)
    h = height_m / 7.4
    sy = min(1.16, max(0.86, 0.88 + (float(three_d.get("faceRatio") or 1.2) - 1.05) * 0.4))
    return height_m * 0.77 + h * (0.308 + sy)


def test_glb(sweep: bool) -> None:
    section("8. /api/glb — Blender headless dựng GLB có rig")
    if not settings.blender_ready:
        print("  ⚠ Bỏ qua: máy chưa có Blender (đặt BLENDER_PATH rồi chạy lại)")
        return

    for spec in [DEMO_SPEC] + (SWEEP_SPECS if sweep else []):
        res = client.post("/api/glb", json=spec_payload(spec))
        expect(res.status_code == 200, f"HTTP {res.status_code}: {res.text[:200]}")
        expect(res.content[:4] == b"glTF", "thiếu magic 'glTF' của file GLB")
        expect(res.headers["content-type"] == "model/gltf-binary",
               f"content-type sai: {res.headers['content-type']}")
        expect(int(res.headers["X-Glb-Bytes"]) == len(res.content), "X-Glb-Bytes không khớp")
        expect(res.headers.get("X-Model-bones") == "19",
               f"phải có 19 xương, nhận {res.headers.get('X-Model-bones')}")

        out = TMP_DIR / f"selftest-{spec['id']}.glb"
        out.write_bytes(res.content)
        info = glb_info.summarize(out)
        expect(info["version"] == 2, f"GLB phải là phiên bản 2, nhận {info['version']}")
        expect(info["meshes"] == 1, f"phải nối thành 1 mesh, nhận {info['meshes']}")
        expect(info["skins"] == 1, f"phải có đúng 1 skin, nhận {info['skins']}")
        expect(info["joints"] >= 19, f"thiếu xương trong skin: {info['joints']}")
        expect(info["animations"] == 0, "chưa xuất animation (đúng như thiết kế)")
        expect(len(info["materials"]) >= 8, f"thiếu vật liệu: {info['materials']}")
        joints = info["jointNames"]
        for bone in ("Hips", "Spine", "Chest", "Neck", "Head",
                     "UpperArm.L", "Forearm.R", "Thigh.L", "Shin.R", "Foot.R"):
            expect(bone in joints, f"thiếu xương {bone}")

        box = info["bbox"]
        expect(box["min"] is not None, "không đọc được hộp bao (accessor POSITION)")
        height = box["size"][1]
        expect(abs(box["min"][1]) <= 0.02, f"bàn chân phải chạm sàn (minY = {box['min'][1]})")
        want = expected_body_height(spec["threeD"])
        expect(want - 0.04 <= height <= float(spec["threeD"]["heightM"]) + 0.04,
               f"cao {height} m ngoài khoảng mong đợi [{round(want - 0.04, 3)}, "
               f"{round(float(spec['threeD']['heightM']) + 0.04, 3)}]")
        expect(0.10 < box["size"][0] < 0.80, f"bề ngang bất thường: {box['size'][0]}")
        # Bề sâu: thân ≈ 0.15 m; mũ rộng vành/túi tóc ≈ 0.42 m ⇒ trần 0.50 m.
        # (Từng có lỗi đặt chỏm cầu capsule lệch trục làm bề sâu vọt lên 0.54 m.)
        expect(0.05 < box["size"][2] < 0.50, f"bề sâu bất thường: {box['size'][2]}")
        expect(abs(box["min"][0] + box["max"][0]) < 0.05,
               f"nhân vật phải đối xứng trái/phải: {box['min'][0]} vs {box['max'][0]}")

        # Blender xuất xong thì dọn file trung gian, chỉ giữ .glb để soi
        expect(len(list(TMP_DIR.glob("*.spec.json"))) == 0,
               "phải dọn sạch spec.json tạm trong api/data/tmp")
        out.unlink(missing_ok=True)

    # rig=false -> không có skin (dùng cho ai chỉ cần mesh tĩnh)
    res = client.post("/api/glb", json={**spec_payload(), "rig": False, "smooth": False})
    expect(res.status_code == 200, f"HTTP rig=false: {res.status_code}: {res.text[:160]}")
    out = TMP_DIR / "selftest-norig.glb"
    out.write_bytes(res.content)
    info = glb_info.summarize(out)
    expect(info["skins"] == 0, f"rig=false thì không được có skin, nhận {info['skins']}")
    expect(info["joints"] == 0, "rig=false thì không có joint")
    expect(info["meshes"] == 1, "vẫn phải là 1 mesh")
    out.unlink(missing_ok=True)

    # Blender hỏng -> BlenderError với log thật (ở đây cố tình trỏ vào python.exe)
    broken = blender_engine.BlenderEngine(Settings(blender_path=sys.executable))
    try:
        broken.build_glb(DEMO_SPEC)
        raise CheckFailed("đường dẫn Blender sai phải ném BlenderError")
    except BlenderError as exc:
        expect("GLB lỗi" in str(exc) or "quá" in str(exc),
               f"thông báo lỗi chưa chỉ đúng nguyên nhân: {exc}")


# ── Điều phối ──────────────────────────────────────────────
def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Kiểm thử backend MMA NhanVatAI")
    parser.add_argument("--fast", action="store_true",
                        help="bỏ nhóm Blender (vài giây; hợp với CI không có Blender)")
    parser.add_argument("--sweep", action="store_true",
                        help="dựng thêm 2 nhân vật khác kiểu tóc/phụ kiện (lâu hơn ~1 phút)")
    args = parser.parse_args(argv[1:])

    print("═══ KIỂM THỬ BACKEND API — MMA NhanVatAI ═══")
    print(f"Blender      : {settings.blender_path or '⚠ chưa tìm thấy'}")
    print(f"Provider AI  : {', '.join(settings.ai_providers()) or 'không có (chỉ kiểm nhánh lỗi)'}")
    print(f"DeepSeek     : {'có key' if settings.llm_ready else 'chưa có key (kiểm nhánh lỗi)'}")
    print(f"Thư viện test: {os.environ['LIBRARY_DIR']}")

    run("Đèn báo & thông tin dịch vụ (/health, /)", test_health)
    run("/api/engines (Blender + khoá AI)", test_engines)
    run("Kiểm tra spec đầu vào", test_validation)
    run("Chân dung PNG (Pillow)", test_portrait_png)
    run("PNG cho đủ 12 phụ kiện × 5 kiểu râu", test_portrait_accessories)
    run("Thư viện server (GET/POST/DELETE)", test_library)
    run("Engine khi chưa cấu hình (không gọi mạng)", test_engines_unit)
    if args.fast:
        section("8. /api/glb — Blender headless")
        print("  ⚠ Bỏ qua (--fast): chạy lại không có --fast để dựng GLB thật")
    else:
        run("Dựng GLB bằng Blender headless", lambda: test_glb(args.sweep))

    print("\n" + "═" * 60)
    print(f"═══ KẾT QUẢ API: {PASS} PASS / {FAIL} FAIL ═══")
    if FAIL:
        print("Kiểm tra hỏng:")
        for label in FAILED[:12]:
            print(f"  • {label}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

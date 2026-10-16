"""
mma_bridge.py — Addon Blender: cầu nối để backend/api dựng nhân vật NGAY trong
Blender đang mở (chế độ "live", lấy ý tưởng từ MCP Blender / blender-mcp).

Vì sao cần: bản mặc định của backend chạy Blender **headless** (`blender -b`),
phù hợp máy chủ nhưng anh không nhìn thấy gì. Addon này mở một socket
127.0.0.1:9876 trong Blender GUI, nhận lệnh JSON, dựng nhân vật vào scene đang
mở để anh sửa tay, xem viewport, rồi (tuỳ chọn) export GLB/FBX.

Khác biệt QUAN TRỌNG so với MCP Blender: addon này **KHÔNG chạy code tuỳ ý**
(`execute_blender_code`). Nó chỉ nhận **allowlist** lệnh cố định; mọi lệnh lạ bị
từ chối kèm giải thích. Lý do: backend có thể được đặt trên máy chủ khác, còn
MCP của blender-mcp chỉ chạy localhost cho LLM.

Cài đặt:
    1. Blender -> Edit > Preferences > Add-ons > Install... -> chọn file này
    2. Bật addon "MMA NhanVatAI — Cầu nối dựng nhân vật"
    3. Mở Sidebar (phím N) trong View3D -> tab "MMA Bridge" -> Start
    4. Server tự lắng nghe tại 127.0.0.1:9876 (đổi được ở Add-on Preferences)

Giao thức: 1 kết nối = 1 request, JSON kết thúc bằng '\\n':
    → {"type": "build_character", "params": {"spec": {...}, "clear": true}}
    ← {"status": "success", "result": {"objects": 1, "bones": 19, "skin": "..."}}
    ← {"status": "error", "message": "..."}            (lệnh lạ / lỗi dựng hình)

Lệnh được phép: ping · scene_info · build_character · export_glb · viewport_png
"""

from __future__ import annotations

import importlib.util
import json
import os
import socket
import threading
import traceback
from collections import deque

import bpy

bl_info = {
    "name": "MMA NhanVatAI — Cầu nối dựng nhân vật",
    "author": "MMA NhanVatAI",
    "version": (1, 0, 0),
    "blender": (4, 0, 0),
    "location": "View3D > Sidebar (N) > MMA Bridge",
    "description": "Socket server dựng nhân vật từ spec.threeD (allowlist, không chạy code tuỳ ý)",
    "category": "Object",
}

DEFAULT_HOST = os.environ.get("BLENDER_BRIDGE_HOST", "127.0.0.1")
DEFAULT_PORT = int(os.environ.get("BLENDER_BRIDGE_PORT", "9876"))
ALLOWED_COMMANDS = ("ping", "scene_info", "build_character", "export_glb", "viewport_png")
COLLECTION_NAME = "MMA_NhanVatAI"

LOG: deque = deque(maxlen=12)
_SERVER: "BridgeServer | None" = None
_BUILDER = None


def log(message: str) -> None:
    """Ghi 1 dòng vào log của addon (hiện trong panel)."""
    LOG.appendleft(str(message))
    print(f"[mma-bridge] {message}")


# ── Nạp module dựng hình dùng chung với backend/api ────────
def builder_path() -> str:
    """Tìm `api/blender/build_character.py` (đặt MMA_BUILDER_PATH nếu khác)."""
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.environ.get("MMA_BUILDER_PATH", ""),
        os.path.join(here, "..", "blender", "build_character.py"),
        os.path.join(here, "..", "..", "blender", "build_character.py"),
    ]
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return os.path.abspath(candidate)
    return ""


def load_builder():
    """Nạp (và cache) `build_character.py` — cùng mã dựng hình với backend."""
    global _BUILDER
    if _BUILDER is not None:
        return _BUILDER
    path = builder_path()
    if not path:
        raise RuntimeError(
            "Không tìm thấy api/blender/build_character.py. Đặt biến môi trường "
            "MMA_BUILDER_PATH trỏ tới file đó rồi mở lại Blender."
        )
    spec = importlib.util.spec_from_file_location("mma_build_character", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _BUILDER = module
    return module


# ── Chạy việc trên luồng chính của Blender ─────────────────
class _Job:
    """Bọc 1 hàm để `bpy.app.timers` gọi trên luồng chính (bpy không thread-safe)."""

    def __init__(self, fn):
        self.fn = fn
        self.done = threading.Event()
        self.result = None
        self.error = None

    def __call__(self):
        try:
            self.result = self.fn()
        except Exception as exc:                     # noqa: BLE001 - trả lỗi qua socket
            self.error = f"{exc.__class__.__name__}: {exc}"
        finally:
            self.done.set()
        return None                                  # không lặp lại


def run_on_main(fn, timeout: float = 240.0):
    """Gọi `fn` trên luồng chính của Blender rồi chờ kết quả.

    `bpy.context` là **thread-local**: khi ở luồng phụ (luồng socket), Blender chỉ
    cho đọc dữ liệu, các toán tử (`bpy.ops.*`) sẽ lỗi
    `'Context' object has no attribute 'active_object'`. Vì vậy mọi việc dựng
    hình phải chạy trên luồng chính:

    - Blender **có giao diện**: dùng `bpy.app.timers` để nhảy sang luồng chính.
    - Blender **chế độ nền** (`blender -b`): không có vòng lặp sự kiện nên timer
      không chạy ⇒ chỉ cho phép khi lời gọi đã ở luồng chính (test tự động chạy
      `--python`), còn lời gọi từ socket bị từ chối với thông báo rõ ràng —
      trường hợp này backend nên dùng chế độ headless (chạy tiến trình riêng).
    """
    if bpy.app.background:
        if threading.current_thread() is threading.main_thread():
            return fn()
        raise RuntimeError(
            "Blender đang ở chế độ nền (-b): cầu nối chỉ nhận lệnh đọc (ping, scene_info). "
            "Muốn dựng nhân vật, hãy mở Blender có giao diện rồi bật addon, "
            "hoặc để backend dùng chế độ headless (blender -b --python build_character.py)."
        )
    job = _Job(fn)
    bpy.app.timers.register(job, first_interval=0.01, persistent=False)
    if not job.done.wait(timeout):
        raise TimeoutError(f"Blender chưa xử lý xong sau {timeout:g}s.")
    if job.error:
        raise RuntimeError(job.error)
    return job.result


# ── Collection riêng: dọn nhân vật của addon mà không đụng scene người dùng ──
def mma_collection():
    coll = bpy.data.collections.get(COLLECTION_NAME)
    if coll is None:
        coll = bpy.data.collections.new(COLLECTION_NAME)
        bpy.context.scene.collection.children.link(coll)
    return coll


def clear_previous() -> int:
    """Xoá nhân vật do addon dựng trước đó."""
    coll = bpy.data.collections.get(COLLECTION_NAME)
    if coll is None:
        return 0
    removed = 0
    for obj in list(coll.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
        removed += 1
    return removed


# ── Các lệnh được phép ─────────────────────────────────────
def scene_info() -> dict:
    coll = bpy.data.collections.get(COLLECTION_NAME)
    return {
        "blender": bpy.app.version_string,
        "file": bpy.data.filepath or "(chưa lưu)",
        "objects": len(bpy.context.scene.objects),
        "mmaObjects": [obj.name for obj in coll.objects] if coll else [],
    }


def build_character(params: dict) -> dict:
    """Dựng nhân vật từ `spec.threeD` vào scene đang mở (join + rig như backend)."""
    spec = params.get("spec") or {}
    three_d = spec.get("threeD") if isinstance(spec, dict) else None
    if not isinstance(three_d, dict) or not three_d:
        raise ValueError("params.spec phải là character card có trường 'threeD'.")

    builder = load_builder()
    builder.PARTS.clear()
    cleared = clear_previous() if params.get("clear", True) else 0
    # KHÔNG gọi read_factory_settings: sẽ xoá mất việc đang làm của người dùng.
    anchors = builder.build_character_mesh(three_d, params)
    body = builder.join_parts("body")
    builder.cleanup_mesh(body)
    mode = "none"
    if params.get("rig", True):
        mode = builder.skin(body, builder.build_rig(anchors))

    coll = mma_collection()
    for obj in [body, body.parent]:
        if obj is None:
            continue
        for owner in list(obj.users_collection):
            owner.objects.unlink(obj)
        coll.objects.link(obj)

    return {
        "cleared": cleared,
        "objects": 2 if body.parent else 1,
        "parts": len(builder.PARTS),
        "vertices": len(body.data.vertices),
        "bones": len(body.parent.data.bones) if body.parent else 0,
        "skin": mode,
        "heightM": round(anchors["H"], 3),
        "collection": COLLECTION_NAME,
    }


def export_glb(params: dict) -> dict:
    """Xuất GLB từ scene hiện tại (đặt `build: true` nếu muốn dựng trước)."""
    path = str(params.get("path") or "").strip()
    if not path:
        raise ValueError("Thiếu params.path — đường dẫn file .glb cần ghi.")
    if params.get("build"):
        build_character(params)
    builder = load_builder()
    folder = os.path.dirname(os.path.abspath(path))
    if folder:
        os.makedirs(folder, exist_ok=True)

    # Chỉ xuất nhân vật của addon -> không lẫn Cube/vật thể khác trong scene.
    coll = bpy.data.collections.get(COLLECTION_NAME)
    selected = 0
    if coll is not None and len(coll.objects):
        bpy.ops.object.select_all(action="DESELECT")
        for obj in coll.objects:
            obj.select_set(True)
            selected += 1
    builder.export_glb(path, selection_only=selected > 0)
    return {"path": os.path.abspath(path), "bytes": os.path.getsize(path), "selected": selected}


def viewport_png(params: dict) -> dict:
    """Chụp ảnh khung nhìn (chỉ khi Blender mở giao diện)."""
    if bpy.app.background:
        raise RuntimeError("Chụp viewport cần Blender mở giao diện, không dùng ở chế độ -b.")
    path = str(params.get("path") or os.path.join(bpy.app.tempdir, "mma-viewport.png"))
    scene = bpy.context.scene
    previous = scene.render.filepath
    scene.render.filepath = path
    try:
        bpy.ops.render.opengl(write_still=True)
    finally:
        scene.render.filepath = previous
    size = os.path.getsize(path) if os.path.exists(path) else 0
    return {"path": path, "bytes": size}


HANDLERS = {
    "ping": lambda _params: {
        "blender": bpy.app.version_string,
        "builder": builder_path(),
        "allowed": list(ALLOWED_COMMANDS),
        "mode": "background" if bpy.app.background else "gui",
    },
    "scene_info": lambda _params: scene_info(),
    "build_character": build_character,
    "export_glb": export_glb,
    "viewport_png": viewport_png,
}


def handle(request: dict) -> dict:
    """Điều phối 1 request — chỉ nhận lệnh trong `ALLOWED_COMMANDS`."""
    if not isinstance(request, dict):
        return {"status": "error", "message": "Request phải là object JSON."}
    kind = str(request.get("type") or "")
    params = request.get("params") or {}
    if kind not in ALLOWED_COMMANDS:
        return {"status": "error", "message": (
            f"Lệnh '{kind}' không có trong allowlist {list(ALLOWED_COMMANDS)}. "
            "Cầu nối này cố tình KHÔNG chạy code Python tuỳ ý từ xa "
            "(khác `execute_blender_code` của MCP Blender)."
        )}
    try:
        timeout = float(params.get("timeout") or 240)
    except (TypeError, ValueError):
        timeout = 240.0
    try:
        result = run_on_main(lambda: HANDLERS[kind](params), timeout=timeout)
    except Exception as exc:                          # noqa: BLE001 - trả về qua socket
        log(f"LỖI {kind}: {exc}")
        return {"status": "error", "message": f"{exc.__class__.__name__}: {exc}"}
    log(f"OK {kind}")
    return {"status": "success", "result": result}


# ── Socket server ──────────────────────────────────────────
class BridgeServer(threading.Thread):
    """Nghe TCP; mỗi kết nối = 1 request JSON kết thúc bằng ký tự xuống dòng."""

    daemon = True

    def __init__(self, host: str, port: int):
        super().__init__(name="mma-bridge")
        self.host, self.port = host, port
        self._stop = threading.Event()
        self.sock = None
        self.error = ""

    def run(self) -> None:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
                server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                server.bind((self.host, self.port))
                server.listen(4)
                server.settimeout(0.5)
                self.sock = server
                log(f"Đang nghe {self.host}:{self.port}")
                while not self._stop.is_set():
                    try:
                        conn, _addr = server.accept()
                    except socket.timeout:
                        continue
                    except OSError as exc:
                        self.error = str(exc)
                        break
                    with conn:
                        conn.settimeout(300)
                        self._serve(conn)
        except OSError as exc:
            self.error = f"{exc.__class__.__name__}: {exc}"
            log(f"Không mở được cổng {self.host}:{self.port} → {self.error}")
        finally:
            self.sock = None
            log("Server đã dừng")

    @staticmethod
    def _serve(conn) -> None:
        payload = b""
        while not payload.endswith(b"\n"):
            chunk = conn.recv(65536)
            if not chunk:
                break
            payload += chunk
            if len(payload) > 32_000_000:            # chặn payload rác
                break
        try:
            request = json.loads(payload.decode("utf-8").strip() or "{}")
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            response = {"status": "error", "message": f"JSON không hợp lệ: {exc}"}
        else:
            response = handle(request)
        try:
            conn.sendall((json.dumps(response, ensure_ascii=False) + "\n").encode("utf-8"))
        except OSError:
            pass

    def stop(self) -> None:
        self._stop.set()
        if self.sock is not None:
            try:
                self.sock.close()
            except OSError:
                pass


def send_request(request: dict, host: str = DEFAULT_HOST, port: int = DEFAULT_PORT,
                 timeout: float = 300.0) -> dict:
    """Gửi 1 request và đọc 1 response (dùng cho tự kiểm tra và cho backend)."""
    with socket.create_connection((host, port), timeout=timeout) as conn:
        conn.sendall((json.dumps(request, ensure_ascii=False) + "\n").encode("utf-8"))
        payload = b""
        while not payload.endswith(b"\n"):
            chunk = conn.recv(65536)
            if not chunk:
                break
            payload += chunk
    return json.loads(payload.decode("utf-8").strip() or "{}")


def start_server(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> str:
    global _SERVER
    if _SERVER is not None and _SERVER.is_alive():
        return f"Đang chạy sẵn ở {_SERVER.host}:{_SERVER.port}"
    _SERVER = BridgeServer(host, port)
    _SERVER.start()
    return f"Đã bật ở {host}:{port}"


def stop_server() -> str:
    global _SERVER
    if _SERVER is None:
        return "Chưa bật"
    _SERVER.stop()
    _SERVER = None
    return "Đã tắt"


def server_status() -> str:
    if _SERVER is None:
        return "chưa bật"
    if not _SERVER.is_alive():
        return f"đã dừng ({_SERVER.error})" if _SERVER.error else "đã dừng"
    return f"đang nghe {_SERVER.host}:{_SERVER.port}"


# ── Giao diện Blender ──────────────────────────────────────
def _prefs(context):
    addon = context.preferences.addons.get(__name__)
    return addon.preferences if addon else None


class MMA_OT_server_start(bpy.types.Operator):
    bl_idname = "mma_bridge.start"
    bl_label = "Bật cầu nối"
    bl_description = "Mở socket để backend/api dựng nhân vật ngay vào scene này"

    def execute(self, context):
        prefs = _prefs(context)
        message = start_server(prefs.host if prefs else DEFAULT_HOST,
                               prefs.port if prefs else DEFAULT_PORT)
        self.report({"INFO"}, message)
        return {"FINISHED"}


class MMA_OT_server_stop(bpy.types.Operator):
    bl_idname = "mma_bridge.stop"
    bl_label = "Tắt cầu nối"
    bl_description = "Đóng socket của cầu nối"

    def execute(self, _context):
        self.report({"INFO"}, stop_server())
        return {"FINISHED"}


class MMA_OT_selftest(bpy.types.Operator):
    bl_idname = "mma_bridge.selftest"
    bl_label = "Tự kiểm tra (ping)"
    bl_description = "Gửi lệnh 'ping' tới chính cầu nối để xác nhận đang chạy"

    def execute(self, context):
        prefs = _prefs(context)
        if _SERVER is None or not _SERVER.is_alive():
            self.report({"WARNING"}, "Cầu nối chưa bật — bấm “Bật cầu nối” trước.")
            return {"CANCELLED"}
        try:
            response = send_request({"type": "ping"},
                                    prefs.host if prefs else DEFAULT_HOST,
                                    prefs.port if prefs else DEFAULT_PORT,
                                    timeout=10)
        except OSError as exc:
            self.report({"ERROR"}, f"Không kết nối được: {exc}")
            return {"CANCELLED"}
        if response.get("status") == "success":
            result = response.get("result") or {}
            self.report({"INFO"}, f"OK — Blender {result.get('blender')} · mode {result.get('mode')}")
            return {"FINISHED"}
        self.report({"ERROR"}, str(response.get("message")))
        return {"CANCELLED"}


class MMA_PT_bridge_panel(bpy.types.Panel):
    bl_label = "MMA Bridge"
    bl_idname = "MMA_PT_bridge_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "MMA Bridge"

    def draw(self, context):                             # noqa: D102 - API của Blender
        layout = self.layout
        prefs = _prefs(context)
        host = prefs.host if prefs else DEFAULT_HOST
        port = prefs.port if prefs else DEFAULT_PORT
        layout.label(text=f"Trạng thái: {server_status()}", icon="PLUGIN")
        row = layout.row(align=True)
        row.operator("mma_bridge.start", text="Bật", icon="PLAY")
        row.operator("mma_bridge.stop", text="Tắt", icon="PAUSE")
        layout.operator("mma_bridge.selftest", text="Tự kiểm tra (ping)", icon="CHECKMARK")
        layout.label(text=f"Địa chỉ: {host}:{port}")
        layout.label(text="Chỉ nhận: " + ", ".join(ALLOWED_COMMANDS), icon="LOCKED")
        box = layout.box()
        box.label(text="Nhật ký (mới nhất trước):")
        for line in list(LOG)[:6]:
            box.label(text=line[:58])


class MMA_AddonPreferences(bpy.types.AddonPreferences):
    bl_idname = __name__

    host: bpy.props.StringProperty(name="Host", default=DEFAULT_HOST)
    port: bpy.props.IntProperty(name="Port", default=DEFAULT_PORT, min=1024, max=65535)

    def draw(self, _context):                            # noqa: D102 - API của Blender
        layout = self.layout
        layout.prop(self, "host")
        layout.prop(self, "port")
        layout.label(text="Backend đặt BLENDER_BRIDGE_HOST/PORT cho khớp giá trị này.")


CLASSES = (
    MMA_OT_server_start,
    MMA_OT_server_stop,
    MMA_OT_selftest,
    MMA_PT_bridge_panel,
    MMA_AddonPreferences,
)


def register() -> None:
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    log("Addon đã bật — bấm “Bật cầu nối” ở Sidebar (N) > MMA Bridge")


def unregister() -> None:
    stop_server()
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":              # chạy trực tiếp trong Blender để thử nhanh
    register()

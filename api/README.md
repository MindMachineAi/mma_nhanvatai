# Backend API — MMA NhanVatAI

Thư mục này là **lớp nâng cấp tuỳ chọn** (bước 5 & 6 của lộ trình): nó thêm ba thứ
mà trình duyệt không làm được — **Blender headless dựng GLB có rig**, **AI vẽ chân
dung** (prompt do **DeepSeek** viết lại) và **thư viện nhân vật trên server**.

> **Nguyên tắc giữ nguyên:** web vẫn chạy đầy đủ khi API tắt. API tắt ⇒ chỉ khoá
> nút **Dựng bằng Blender** và **Nâng cấp bằng AI**, kèm thông báo tiếng Việt chỉ
> đúng cách bật. Không ràng buộc nào của backend được rò vào phần lõi.

---

## 1. Chạy trong 3 bước

```bash
# 1) Cài phụ thuộc (Python 3.10+; máy dev dùng 3.12)
pip install -r api/requirements.txt

# 2) Cấu hình: copy .env.example -> .env ở GỐC repo rồi điền key nếu có
#    (bỏ trống hết vẫn chạy: Blender tự dò, AI vẫn vẽ được bằng Pollinations)

# 3) Bật server
cd api
uvicorn main:app --port 8077 --reload
```

Mở web (`cd web; npm run dev` → http://127.0.0.1:5173) và bấm **Kiểm tra lại** ở
header: chấm chuyển **xanh “API đã bật”**. Xem API đang trả gì:

- `http://127.0.0.1:8077/health` — sống/chết
- `http://127.0.0.1:8077/api/engines` — Blender đã cài? có key AI nào?
- `http://127.0.0.1:8077/docs` — tài liệu tự sinh (Swagger UI)

## 2. Kiểm thử

```bash
python api/selftest.py            # đầy đủ: có dựng GLB THẬT bằng Blender (~1 phút)
python api/selftest.py --fast     # bỏ nhóm Blender (~15 giây)
python api/selftest.py --sweep    # dựng thêm 2 nhân vật khác kiểu tóc/phụ kiện
```

Bộ test chạy **không cần trình duyệt, không cần pytest, không gọi mạng** (các
provider AI được kiểm ở nhánh cấu hình/lỗi), kết thúc bằng dòng tổng kết kiểu repo:

```text
═══ KẾT QUẢ API: 209 PASS / 0 FAIL ═══
```

| Nhóm | Kiểm gì |
| --- | --- |
| 1–2 | `/health`, `/`, `/api/engines` — hình dạng dữ liệu mà web đang chờ |
| 3 | Spec sai bị chặn với thông báo tiếng Việt (422, không phải 500) |
| 4 | `/api/portrait.png`: magic bytes PNG, kích thước đúng, **tất định** (cùng spec → cùng bytes), 4 phong cách × 12 kiểu tóc |
| 5 | 12 phụ kiện × 5 kiểu râu đều vẽ được |
| 6 | Thư viện server: lưu = cập nhật theo `id`, mới nhất lên đầu, xoá, 404, file hỏng |
| 7 | Blender/AI/DeepSeek ở nhánh **chưa cấu hình** (thông báo chỉ đúng chỗ cần sửa) |
| 8 | Dựng GLB thật: magic `glTF`, 1 mesh + 1 skin + 19 xương, tên xương, **bàn chân chạm sàn (minY ≈ 0)**, chiều cao đúng công thức `figure.js`, bề sâu/đối xứng, `rig:false` không có skin |

Ngoài ra `api/tools/glb_info.py` đọc thẳng file GLB (không cần Blender,
không cần three.js) để soi nhanh 1 file bất kỳ:

```bash
python api/tools/glb_info.py api/data/output/<job>.glb
```

## 3. Chín endpoint

| Method | Path | Body | Kết quả | Ghi chú |
| --- | --- | --- | --- | --- |
| GET | `/health` | – | `{ status: "ok", version, uptimeSec }` | web dùng cho đèn xanh/đỏ (timeout 2.5 s) |
| GET | `/api/engines` | – | Blender có cài? có key AI/DeepSeek nào? thư viện bao nhiêu bản ghi | nút “Kiểm tra lại” |
| POST | `/api/portrait.png` | `{ spec, size?, caption? }` | **PNG** (Pillow, không cần mạng) | `size` kẹp trong 128…2048 |
| POST | `/api/glb` | `{ spec, rig?, smooth?, keep_parts?, dump_parts? }` | **GLB** (Blender headless) | header `X-Model-bones`, `X-Blender-Seconds` |
| POST | `/api/portrait/ai` | `{ spec, style?, size?, prompt? }` | `{ provider, prompt, promptSource, imageBase64 \| imageUrl }` | Gemini → MeToken → Pollinations |
| POST | `/api/ai/character` | `{ spec }` | `{ description, motto, prompt, traits }` | **DeepSeek** (endpoint mở rộng, web có thể gọi sau) |
| GET | `/api/library` | – | `[ bản ghi nhân vật ]` | mới nhất lên đầu |
| POST | `/api/library` | `{ spec }` | bản ghi đã lưu | cùng `id` ⇒ **cập nhật**, không nhân bản |
| DELETE | `/api/library/{id}` | – | `{ deleted, id }` | id lạ ⇒ 404 kèm thông báo tiếng Việt |

Mọi lỗi đều trả `{ "detail": "<tiếng Việt>" }` — đúng như `web/src/api.js` đang
đọc, nên web hiện thẳng qua toast mà **không cần sửa gì**.

## 4. Blender: hai chế độ kết nối

| | **Chế độ 1 — headless** *(mặc định, dùng cho VPS/Docker)* | **Chế độ 2 — cầu nối trực tiếp** *(kiểu MCP Blender)* |
| --- | --- | --- |
| Cách chạy | `blender -b --factory-startup --python api/blender/build_character.py -- <spec.json> <out.glb>` | Addon `api/blender_addon/mma_bridge.py` mở socket `127.0.0.1:9876` **trong Blender đang mở** |
| Ai gọi | Backend tự chạy tiến trình (endpoint `/api/glb`) | Backend gửi JSON qua socket: `{"type":"build_character","params":{"spec":{…}}}` |
| Ưu điểm | Không cần giao diện, chạy hàng loạt, kết quả tất định | Nhìn thấy nhân vật trong scene đang làm, sửa tay, export thêm FBX/OBJ/`.blend` |
| Hạn chế | Mỗi lần dựng tốn vài giây khởi động Blender | Cần Blender mở + addon bật; không dùng được ở chế độ `-b` |
| Giao thức | – | 1 kết nối = 1 request JSON (kết thúc `\n`) → `{"status":"success","result":{…}}` |

**An toàn:** addon **không** nhận code Python tuỳ ý như `execute_blender_code` của
MCP Blender. Nó chỉ chạy 5 lệnh cố định — `ping`, `scene_info`,
`build_character`, `export_glb`, `viewport_png`; mọi lệnh khác bị từ chối kèm
giải thích. Lý do rất thực tế: cầu nối có thể bị gọi từ máy khác, còn MCP của
`blender-mcp` chỉ phục vụ LLM trên cùng máy.

### Cài addon (chế độ 2)

1. Blender → **Edit ▸ Preferences ▸ Add-ons ▸ Install…** → chọn
   `api/blender_addon/mma_bridge.py` → bật addon.
2. Trong **View3D** bấm **N** → tab **MMA Bridge** → **Bật cầu nối**
   (đổi host/port ở Preferences của addon; mặc định `127.0.0.1:9876`).
3. **Tự kiểm tra (ping)** để xác nhận; nhật ký hiện ngay trong panel.
4. Backend trỏ tới cầu nối bằng `BLENDER_BRIDGE_HOST` / `BLENDER_BRIDGE_PORT`.

Addon tự tìm `api/blender/build_character.py` (cùng file mà backend headless
dùng) nên **hai chế độ luôn dựng ra cùng một nhân vật**; đặt biến
`MMA_BUILDER_PATH` nếu file nằm chỗ khác. Nhân vật được đưa vào collection riêng
**MMA_NhanVatAI** để lần dựng sau dọn dẹp mà không đụng phần scene của bạn.

## 5. DeepSeek dùng để làm gì?

DeepSeek là **LLM**, không vẽ ảnh — nên nó được cắm vào đúng chỗ cần chữ nghĩa:

```text
spec.prompt (offline, do Character Engine sinh)
      │  ← DeepSeek viết lại thành prompt ảnh tiếng Anh chi tiết (ánh sáng, ống kính, bố cục)
      ▼
Gemini  →  MeToken  →  Pollinations   (vẽ ảnh)
```

- `/api/portrait/ai` tự động dùng DeepSeek để viết lại prompt **trước khi vẽ**
  (bật/tắt bằng `{ "useLlm": false }`).
- `/api/ai/character` trả về mô tả 3 đoạn, châm ngôn, nét tính cách và prompt ảnh
  mới — dùng để “nâng cấp hồ sơ” mà **không đổi** danh tính/nghề/tuổi.
- **Không có `DEEPSEEK_API_KEY` thì mọi thứ vẫn chạy**: web dùng prompt do
  Character Engine sinh sẵn (lớp lùi được thiết kế chứ không phải lỗi).
- Lỗi DeepSeek được phân loại rõ: `401` key sai, `402` hết số dư, timeout…
  và luôn kèm việc cần làm tiếp.

## 6. Biến môi trường

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `API_HOST` / `API_PORT` | `127.0.0.1` / `8077` | địa chỉ backend |
| `CORS_ORIGINS` | `localhost:5173,127.0.0.1:5173` | thêm `:4173` (vite preview) tự động |
| `BLENDER_PATH` | tự dò | đường dẫn `blender.exe` |
| `BLENDER_TIMEOUT` | `240` | giây tối đa cho 1 lần dựng GLB |
| `BLENDER_BRIDGE_HOST/PORT` | `127.0.0.1` / `9876` | địa chỉ cầu nối của addon |
| `DEEPSEEK_API_KEY` / `_MODEL` / `_BASE_URL` / `_TIMEOUT` | trống · `deepseek-chat` · `https://api.deepseek.com` · `90` | LLM |
| `GEMINI_API_KEY` / `GEMINI_IMAGE_MODEL` | trống · `gemini-2.5-flash-image` | provider ảnh 1 |
| `METOKEN_API_KEY` / `_IMAGE_MODEL` / `_BASE_URL` | trống · `gpt-image-2` · `https://api.metoken.ai/v1` | provider ảnh 2 (tương thích OpenAI) |
| `PORTRAIT_ALLOW_POLLINATIONS` | `true` | provider ảnh 3, không cần key |
| `PORTRAIT_TIMEOUT` | `180` | giây tối đa cho 1 lần vẽ ảnh |
| `LIBRARY_DIR` | `api/data/library.json` | thư mục **hoặc** file `.json` của thư viện |
| `VITE_API_BASE` | `http://127.0.0.1:8077` | **phía web** (chỉ dùng khi dev) |

`.env` ở gốc repo là chuẩn; `api/.env` (nếu có) chỉ bù thêm. Biến đã có trong
môi trường luôn thắng — nhờ đó test tự động ép được `LIBRARY_DIR` riêng.

## 7. Cấu trúc thư mục

```text
api/
├── main.py                 FastAPI app — 9 endpoint, CORS, exception handler
├── config.py               Settings: đọc .env, dò Blender, liệt kê provider AI
├── library_store.py        Thư viện nhân vật (JSON, ghi an toàn, mới nhất lên đầu)
├── selftest.py             209 kiểm tra / 8 nhóm chạy không cần mạng
├── requirements.txt        fastapi, uvicorn, pillow, requests, python-dotenv
├── engines/
│   ├── portrait_png.py     Vẽ chân dung bằng Pillow (12 kiểu tóc, 5 kiểu râu, 12 phụ kiện)
│   ├── ai_portrait.py      Gemini → MeToken → Pollinations (+ DeepSeek viết lại prompt)
│   ├── llm.py              DeepSeek: viết lại prompt, mô tả hồ sơ nhân vật
│   └── blender.py          Chạy Blender headless, đọc `__MMA_RESULT__`, quản lý timeout/tệp tạm
├── blender/
│   └── build_character.py  Script bpy: dựng mesh từ spec (đồng bộ 1:1 với web) + rig 19 xương + export GLB
├── blender_addon/
│   └── mma_bridge.py       Addon cầu nối trong Blender đang mở (socket + allowlist + panel UI)
├── tools/
│   └── glb_info.py         Đọc GLB không cần Blender (chunk, mesh, skin, xương, bbox)
└── data/                   Sinh ra lúc chạy (không commit)
    ├── library.json        Thư viện nhân vật
    ├── tmp/                spec + log tạm của mỗi lần dựng
    └── output/             file .glb/.png trả về
```

**Một nguồn sự thật:** `web/src/viewer/figure.js` là bản chuẩn của dáng người;
`build_character.py` chép lại **cùng công thức** cho Blender. Nhờ vậy nhân vật
dựng bằng Blender đứng đúng tỉ lệ, đúng chiều cao như trên web.

## 8. Bảo mật

- Backend **không có** endpoint thực thi mã, không đọc/ghi tệp tuỳ ý: đường dẫn
  GLB do server tự sinh trong `api/data/output/`.
- Cầu nối addon chỉ nghe `127.0.0.1` và chỉ chạy **allowlist 5 lệnh**; không có
  `execute_blender_code`.
- Blender headless chạy với `--factory-startup` (không nạp addon lạ của người
  dùng) và `--python-exit-code 1` (script lỗi ⇒ tiến trình trả mã lỗi, không
  “thành công giả”).
- Blender headless cũng chỉ nhận spec qua tệp JSON tạm, không nhận đường dẫn do
  người ngoài chỉ định.
- CORS chỉ mở cho các cổng dev của Vite; deploy thật thì khai báo `CORS_ORIGINS`.
- API key chỉ nằm ở backend (`.env`), **không** bao giờ gửi xuống trình duyệt.

## 9. Xử lý sự cố

| Hiện tượng | Nguyên nhân & cách xử lý |
| --- | --- |
| Web vẫn chạy nhưng nút AI báo “không kết nối được backend” | Bình thường khi tắt API. Chạy `python -m uvicorn api.main:app --port 8077` rồi bấm **Kiểm tra lại** |
| `/api/glb` trả `detail` về Blender | `BLENDER_PATH` sai hoặc Blender chưa cài. `/api/engines` cho biết đường dẫn nó dò được |
| Dựng GLB chậm (~10–30 s) | Mỗi lần là một tiến trình Blender mới. Muốn nhanh hơn hãy dùng addon cầu nối (chế độ 2) |
| Cảnh báo `Mesh body is not valid, and may be exported wrongly` | **Vô hại**: mesh ghép từ hàng chục khối rời nên exporter nhắc. `build_character.py` đã tính lại pháp tuyến + `Mesh.validate()`; GLB vẫn có đủ mesh/skin/xương và three.js đọc tốt |
| `glb_info.py` báo `joints: 20` dù rig chỉ có 19 xương | Bình thường: Blender tự thêm nút gốc **`neutral_bone`** vào skin (glTF yêu cầu mọi đỉnh có da đều có gốc), nên `skin.joints` = 19 xương + `neutral_bone`. Header `X-Model-bones` và kết quả dựng vẫn là **19** |
| Ảnh AI không ra | Không có key nào ⇒ tự lùi về Pollinations (cần mạng). Xem `provider` trong kết quả để biết đã dùng cái nào |
| DeepSeek báo `402` | Hết số dư tài khoản DeepSeek — **không ảnh hưởng** vẽ ảnh, chỉ mất phần viết lại prompt |
| Cầu nối báo *“Blender đang ở chế độ nền (-b)”* | Đúng thiết kế: `-b` không có vòng lặp sự kiện nên không chạy được toán tử trên luồng chính. Mở Blender có giao diện, hoặc để backend dùng headless |
| Cổng 8077/9876 đang bận | Đổi `API_PORT` / `BLENDER_BRIDGE_PORT`; web đổi theo `VITE_API_BASE` |

### Lệnh nhanh

```bash
python -m uvicorn api.main:app --host 127.0.0.1 --port 8077   # chạy backend
python api/selftest.py                                       # 209 kiểm tra (chậm một chút vì có dựng GLB thật)
python api/selftest.py --fast                                # bỏ nhóm Blender
python api/selftest.py --sweep                               # quét nhiều tổ hợp spec
python api/tools/glb_info.py api/data/output/<job>.glb        # soi 1 file GLB
```

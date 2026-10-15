# MMA NhanVatAI — Trình tạo nhân vật ảo tự động

Sinh **nhân vật ảo hoàn chỉnh** (hồ sơ, ngoại hình, trang phục, tính cách, giọng nói, chỉ
số RPG, prompt ảnh AI, tham số 3D) chỉ từ **một seed**. Cùng seed + cùng ràng buộc →
**cùng nhân vật**, tái tạo được 100% ở bất kỳ máy nào mà không cần lưu ảnh.

Phần lõi chạy **offline ngay trong trình duyệt**: sinh nhân vật, xem trước 3D bằng three.js,
vẽ chân dung SVG, thư viện nhân vật, nhập/xuất JSON, xuất GLB — không cần mạng, không cần
server.

> **Trạng thái dự án:** web creator đã hoàn chỉnh và có kiểm thử tự động.
> Backend FastAPI (`api/`) — dùng để dựng GLB bằng Blender và vẽ chân dung bằng AI —
> **đang trong lộ trình, chưa có trong repo này**. Khi chưa bật API, web vẫn dùng đầy đủ
> tính năng (góc phải trên hiển thị “API đang tắt”).

## Tính năng

| Nhóm | Chi tiết |
| --- | --- |
| Sinh nhân vật | Character Engine **tất định** (hash `xmur3` + PRNG `mulberry32`): 26 nghề nghiệp, 12 kiểu tóc, 12 bộ trang phục, 5 vóc dáng, 6 dáng mặt, 3 giới tính, 12 phụ kiện, 18 quê quán, 8 nguyên mẫu tính cách, 4 phong cách ảnh |
| Ràng buộc | Khoá sẵn giới tính / nghề nghiệp trước khi sinh; sửa bất kỳ ô ngoại hình nào thì mọi trường dẫn xuất (nhãn, mô tả, prompt, tham số 3D) tự tính lại |
| Xem 3D | three.js dựng nhân vật tức thời trong trình duyệt: tư thế động (thở), lưới wireframe, camera mặc định, chụp ảnh PNG |
| Chân dung 2D | SVG sinh từ chính `spec.threeD` nên luôn khớp model đang xem; tải SVG/PNG miễn phí, không tốn lượt gọi AI |
| AI nâng cấp | Prompt tiếng Anh ghép theo đúng tham số nhân vật, chỉ gọi khi bấm nút (Gemini → MeToken → Pollinations) |
| Thư viện | Lưu trong `localStorage`, thumbnail tự dựng lại bằng `portrait.js` (không lưu ảnh), nhập/xuất cả bộ |
| Kết xuất | Character card JSON, GLB xuất trực tiếp từ three.js (nhanh), GLB dựng bằng Blender (qua API) |
| Giao diện | 3 cột: trái điều khiển — giữa xem 3D + chân dung — phải hồ sơ + thư viện; toast thông báo, đèn báo trạng thái API |

## Cấu trúc thư mục

```text
mma_nhanvatai/
├─ web/                       # ỨNG DỤNG CHÍNH (Vite + React 19 + three.js)
│  ├─ src/
│  │  ├─ engine/              # Character Engine (hạt nhân, không phụ thuộc React)
│  │  │  ├─ characterEngine.js  # sinh nhân vật + mọi trường dẫn xuất + FIELD_OPTIONS
│  │  │  ├─ rng.js              # RNG có seed (xmur3 + mulberry32)
│  │  │  ├─ tables.js           # bảng dữ liệu cơ bản (giới tính, da, dáng, mặt, tóc...)
│  │  │  ├─ tables2.js          # trang phục, nghề, phụ kiện, tính cách, giọng, phong cách
│  │  │  ├─ promptEn.js         # ghép prompt tiếng Anh cho AI vẽ ảnh
│  │  │  └─ color.js            # tiện ích màu (hex/rgb, làm tối màu)
│  │  ├─ viewer/              # xem 3D
│  │  │  ├─ figure.js           # dựng hình nhân vật bằng three.js (mesh thuần)
│  │  │  └─ Viewer3D.jsx        # React wrapper: khung xem, camera, ánh sáng, export GLB
│  │  ├─ ui/                  # lớp giao diện
│  │  │  ├─ CreatorForm.jsx     # cột trái: seed, ràng buộc, ngoại hình, nhập/xuất
│  │  │  ├─ ViewerPanel.jsx     # sân khấu 3D + thanh công cụ
│  │  │  ├─ PortraitPanel.jsx   # chân dung SVG/PNG + nút nâng cấp AI
│  │  │  ├─ InfoPanel.jsx       # 4 tab: Hồ sơ · Mô tả · Prompt AI · JSON
│  │  │  └─ LibraryPanel.jsx    # thư viện nhân vật (localStorage)
│  │  ├─ hooks/useLibrary.js  # đọc/ghi thư viện localStorage
│  │  ├─ portrait.js          # vẽ chân dung SVG từ spec.threeD, đổi SVG → PNG
│  │  ├─ api.js               # cầu nối FastAPI (lớp nâng cấp tuỳ chọn) + ApiError
│  │  ├─ App.jsx              # bộ khung, luồng dữ liệu một chiều
│  │  ├─ styles.css           # toàn bộ style (biến CSS, không dùng framework CSS)
│  │  └─ main.jsx             # điểm vào React
│  ├─ tools/smoke-ui.jsx      # kiểm thử khói lớp giao diện (renderToString)
│  ├─ index.html
│  ├─ vite.config.js
│  └─ package.json
├─ tools/
│  ├─ selftest.mjs            # kiểm thử Character Engine (Node, không cần browser)
│  ├─ selftest3d.mjs          # kiểm thử tham số 3D + tính hợp lệ của spec
│  └─ preview.svg             # ảnh xem trước
├─ docs/
│  ├─ KIEN_TRUC.md            # kiến trúc, hợp đồng dữ liệu spec, chiến lược kiểm thử
│  └─ HUONG_DAN_SU_DUNG.md    # hướng dẫn dùng giao diện từng bước
├─ .env.example               # mẫu cấu hình API/Blender/AI
├─ .gitattributes / .gitignore
└─ README.md
```

## Yêu cầu môi trường

| Thành phần | Yêu cầu | Ghi chú |
| --- | --- | --- |
| Node.js | ≥ 20 | đã phát triển & kiểm thử trên **v24.14.1** |
| npm | ≥ 10 | dùng `package-lock.json` trong `web/` |
| Trình duyệt | có **WebGL2** | Chrome / Edge / Firefox / Cốc Cốc bản mới |
| Python 3.12 + Blender 5.2 | *tuỳ chọn* | chỉ cần khi dựng backend `api/` (chưa có trong repo) |

## Cài đặt & chạy

```bash
cd web
npm install
npm run dev          # mở http://127.0.0.1:5173
```

Các lệnh khác trong `web/`:

```bash
npm run build        # đóng gói production vào web/dist
npm run preview      # chạy thử bản build, cổng 5173
```

## Kiểm thử

Ba bộ kiểm thử chạy bằng Node, **không cần trình duyệt** (đều in `✓` từng mục và tổng
`PASS/FAIL`):

```bash
# 1) Character Engine: tất định theo seed, ràng buộc, trường dẫn xuất, bảng dữ liệu
node tools/selftest.mjs                  # 29 PASS

# 2) Tham số 3D: tỉ lệ cơ thể, màu, mesh tóc/phụ kiện, hợp lệ của spec
node tools/selftest3d.mjs                # 62 PASS

# 3) Kiểm thử khói lớp giao diện (render thật cây component rồi kiểm tra HTML)
cd web
npx vite build --ssr tools/smoke-ui.jsx --outDir tools/_out --logLevel warn
node tools/_out/smoke-ui.js              # 21 PASS
```

Bộ số 3 kết xuất toàn bộ app bằng `react-dom/server` nên bắt được: prop truyền sai, thiếu
export, `FIELD_OPTIONS` lệch với engine, lỗi sinh SVG chân dung, lỗi định dạng số… Thư mục
`web/tools/_out/` là sản phẩm tạm của bộ test và **đã được bỏ qua trong git**.

## Hợp đồng dữ liệu `spec` (tóm tắt)

`spec` chính là **character card** — nội dung file JSON mà nút `Xuất JSON` tải về. Đây cũng
là payload gửi lên API. Nhóm trường và ví dụ (seed `NV-DEMO01`):

| Nhóm | Trường chính | Ví dụ |
| --- | --- | --- |
| *(gốc)* | `schema`, `seed`, `style`, `id`, `description`, `prompt`, `updatedAt`, `media` | `schema: 1`, `id: "nv-ly-tue-quan-2925fdbf"` |
| `identity` | `fullName`, `callName`, `gender`, `genderLabel`, `age`, `ageStage`, `occupation`, `occupationLabel`, `hometown`, `nationality` | `"Lý Tuệ Quân"`, 26, `bac_si` |
| `appearance` | `heightCm`, `build`, `skinTone`, `faceShape`, `hairStyle`, `hairColor`, `facialHair`, `eyeColor` | `170`, `gay`, `trai_xoan` |
| `outfit` | `style`, `label`, `top`, `bottom`, `shoes`, `palette` | `chef` / `medical` / `office`… |
| `accessory` | id phụ kiện | `kinh_can`, `tai_nghe`, `khong` |
| `personality` | `archetype`, `archetypeLabel`, `traits[]`, `likes[]`, `dislikes[]`, `motto` | 8 nguyên mẫu, 24 nét tính cách |
| `voice` | `language`, `ttsVoice`, `pitch`, `speed`, `timbre` | `vi-VN`, chất giọng `ấm`/`trầm`… |
| `rpg` | `level`, `stats{ strength, agility, intellect, empathy, charm, tech }` | thang điểm 0–20 |
| `labels` | nhãn tiếng Việt của mọi trường (để hiển thị / ghi file) | `labels.build = "Mảnh khảnh"` |
| `threeD` | `heightM`, `mass`, `width`, `faceRatio`, `jawWidth`, `skin`, `skinShade`, `hair`, `hairMesh`, `facialHairMesh`, `eye`, `top`, `bottom`, `shoes`, `accent`, `accessoryMesh`, `outfitStyle` | `{"heightM":1.7,"mass":0.76,…}` |

`spec.threeD` là **hợp đồng dùng chung**: three.js dựng hình từ đó, `portrait.js` vẽ SVG từ
đó, và Blender (qua API) cũng dựng từ đó — nên 3D, ảnh 2D và GLB luôn khớp nhau.
Chi tiết đầy đủ: [docs/KIEN_TRUC.md](docs/KIEN_TRUC.md).

## Kết nối backend API (tuỳ chọn — **backend chưa có trong repo**)

Web đã sẵn hợp đồng gọi API tại `web/src/api.js`; backend sẽ nằm ở `api/` (FastAPI, cổng
`8077`). Cấu hình qua `.env` — xem mẫu ở [.env.example](.env.example):
`API_HOST`, `API_PORT`, `CORS_ORIGINS`, `BLENDER_PATH`, `BLENDER_TIMEOUT`,
`GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL`, `METOKEN_API_KEY`, `METOKEN_IMAGE_MODEL`,
`PORTRAIT_ALLOW_POLLINATIONS`, `LIBRARY_DIR`, và `VITE_API_BASE` cho web dev.

| Method | Endpoint | Body | Kết quả |
| --- | --- | --- | --- |
| GET | `/health` | – | `{ status: "ok" }` — dùng cho đèn báo “API đã bật” |
| GET | `/api/engines` | – | tình trạng engine: Blender đã cài? đã có key AI nào? |
| POST | `/api/portrait.png` | `{ spec, size }` | PNG (blob) — bản vẽ nét dày hơn SVG trong web |
| POST | `/api/glb` | `{ spec, ...options }` | GLB (blob) — Blender headless dựng model có rig |
| POST | `/api/portrait/ai` | `{ spec, ...options }` | `{ provider, imageUrl \| imageBase64, prompt }` |
| GET | `/api/library` | – | danh sách nhân vật trên server |
| POST | `/api/library` | `{ spec }` | bản ghi đã lưu |
| DELETE | `/api/library/{id}` | – | xoá 1 nhân vật trên server |

Khi API tắt, mọi hàm này ném `ApiError` với thông báo tiếng Việt hướng dẫn cách bật server;
giao diện bắt lỗi và hiện toast, **không làm hỏng** các tính năng offline.

## Quy ước code

- **Chú thích và thông báo bằng tiếng Việt**; tên hàm/biến bằng tiếng Anh; id dữ liệu viết
  không dấu (`bac_si`, `kinh_can`, `trai_xoan`).
- Component React: PascalCase, mỗi file một component chính; component chỉ nhận prop và gọi
  callback, **không tự gọi API** (mọi tác vụ nằm ở `App.jsx`).
- Danh mục cho UI **luôn** lấy từ `FIELD_OPTIONS` — không hard-code ở lớp giao diện.
- Mọi thay đổi với `spec` đi qua `overrideCharacter()` / `finalize()` để trường dẫn xuất
  (nhãn, mô tả, prompt, `threeD`, `id`) luôn đồng bộ; không sửa tay từng trường dẫn xuất.
- Thêm mục dữ liệu mới (nghề, tóc, phụ kiện…) thì bổ sung vào `tables*.js` và ánh xạ mesh
  tương ứng trong `viewer/figure.js` — không cần sửa UI.

## Lộ trình

| Bước | Nội dung | Trạng thái |
| --- | --- | --- |
| 1 | Character Engine tất định + kiểm thử (`selftest`, `selftest3d`) | ✅ xong |
| 2 | Lớp giao diện 3 cột + kiểm thử khói (`smoke-ui`) | ✅ xong |
| 3 | Backend FastAPI: `/health`, `/api/engines`, `portrait.png`, `portrait/ai`, thư viện | ⏳ chưa |
| 4 | Blender headless: dựng GLB có rig từ `spec.threeD` | ⏳ chưa |
| 5 | TTS đọc hồ sơ theo `voice` (ttsVoice / timbre / pitch / speed) | ⏳ chưa |
| 6 | Đồng bộ thư viện web ↔ server hai chiều | ⏳ chưa |

## Giấy phép

Repo hiện **chưa có file `LICENSE`** — mọi quyền thuộc về chủ sở hữu
(`MindMachineAi`). Nếu cần mở cho cộng đồng sử dụng, hãy bổ sung giấy phép phù hợp
(ví dụ MIT) trước khi công bố rộng rãi.



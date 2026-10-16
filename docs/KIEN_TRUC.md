# Kiến trúc — MMA NhanVatAI

Tài liệu này mô tả cách hệ thống được chia tầng, hợp đồng dữ liệu giữa các tầng, và lý do
đằng sau từng quyết định thiết kế. Hướng dẫn thao tác giao diện nằm ở
[HUONG_DAN_SU_DUNG.md](HUONG_DAN_SU_DUNG.md).

## 1. Nguyên tắc thiết kế

1. **Tất định theo seed.** Cùng seed + cùng ràng buộc ⇒ cùng nhân vật. Nhân vật được tái tạo
   bằng thuật toán, không lưu ảnh/model — file JSON nhỏ, chia sẻ dễ, không phình dữ liệu.
2. **Offline-first.** Sinh nhân vật, xem 3D, chân dung SVG, thư viện, xuất GLB đều chạy trong
   trình duyệt. Backend chỉ là “lớp nâng cấp” (Blender GLB chi tiết, AI vẽ chân dung, thư viện
   server). API tắt ⇒ app vẫn dùng được đầy đủ, chỉ khoá 2 nút cần server.
3. **Một nguồn dữ liệu duy nhất.** Mọi danh mục chọn lựa lấy từ `FIELD_OPTIONS` của
   Character Engine. UI không tự khai báo danh sách riêng ⇒ không thể lệch với engine.
4. **Một hợp đồng chung `spec.threeD`.** three.js, `portrait.js` và Blender cùng đọc một cấu
   trúc tham số (đơn vị mét, mã màu hex) nên hình dáng luôn thống nhất giữa các đầu ra.
5. **Luồng dữ liệu một chiều.** `seed/ràng buộc` → `generateCharacter` → `spec` → UI;
   `ô chọn ngoại hình` → `overrideCharacter` → `spec` → UI. Không có state thứ hai song song.
6. **Không framework phụ.** Chỉ React + three.js; style bằng CSS thuần với biến `:root`, nên
   đọc/sửa giao diện rất nhanh và bundle nhẹ.

## 2. Sơ đồ tầng

```text
    seed + ràng buộc (giới tính / nghề / phong cách)
                        │
                        ▼
   engine/rng.js  ──>  engine/tables.js + engine/tables2.js (dữ liệu tĩnh)
                        │
                        ▼
   engine/characterEngine.js
     generateCharacter()  · overrideCharacter()  · finalize()
     buildId() · describeCharacter() · buildImagePrompt() · build3DParams()
                        │
                        ▼
              spec  (character card, có spec.threeD)
                        │
   ┌────────────────────┼───────────────────────┬─────────────────────────┐
   ▼                    ▼                       ▼                         ▼
viewer/figure.js    portrait.js          hooks/useLibrary.js        api.js
   │                    │                       │                         │
Viewer3D.jsx        PortraitPanel.jsx     LibraryPanel.jsx        FastAPI (api/)
(three.js, GLB)     (SVG / PNG)           (localStorage)          Blender GLB · AI ảnh · thư viện
```

## 3. Vai trò từng mô-đun

| Mô-đun | Trách nhiệm | Ghi chú kỹ thuật |
| --- | --- | --- |
| `engine/rng.js` | RNG có seed | `xmur3` hash chuỗi → `mulberry32`; API: `float/int/pick/chance/pickMany/range`; `randomSeed()` tạo `NV-XXXXXX`, `normalizeSeed()` cắt 64 ký tự |
| `engine/tables.js` | Bảng dữ liệu ngoại hình | 3 giới tính, 5 màu da, 5 vóc dáng, 6 dáng mặt, 12 kiểu tóc, 12 màu tóc, 5 kiểu râu, 6 màu mắt |
| `engine/tables2.js` | Bảng dữ liệu còn lại | 12 bộ trang phục (`OUTFITS`), 26 nghề (`OCCUPATIONS`, kèm `hint` cho prompt và `traits`), 12 phụ kiện, 18 quê quán, bảng tên Việt/quốc tế, 8 nguyên mẫu, 24 nét tính cách, sở thích/không thích, châm ngôn, 2 giọng TTS, 6 chất giọng, 4 phong cách ảnh |
| `engine/characterEngine.js` | Hạt nhân sinh nhân vật | `generateCharacter()` rút thăm theo bảng + áp ràng buộc; `overrideCharacter()` deep-merge rồi **đồng bộ lại trang phục theo nghề**; `finalize()` bù nhãn/mô tả/prompt/3D/id; `normalizeSpec()` kiểm tra file JSON nhập vào |
| `engine/promptEn.js` | Ghép prompt tiếng Anh | Dịch id tiếng Việt sang mô tả tiếng Anh (`tr`, `accessoryEn`, `occupationEn`) để Gemini/MeToken/Pollinations hiểu |
| `engine/color.js` | Tiện ích màu | `hexToRgb`, `rgbToHex`, `darken`, `colorName` — dùng để tạo màu đổ bóng trong 3D và SVG |
| `viewer/figure.js` | Dựng hình 3D thuần three.js | Nhân trắc ~7.5 đầu theo chiều cao; mesh tóc/râu/phụ kiện theo id; trả `{ group, parts, update(t), dispose() }`. Không phụ thuộc React |
| `viewer/Viewer3D.jsx` | Khung xem + vòng đời WebGL | Khởi tạo scene/camera/ánh sáng, tự dựng lại khi `threeD` đổi, nạp GLB khi có `modelUrl`, `resetView`, `snapshot()`, export GLB client, `downloadBlob()` |
| `portrait.js` | Chân dung 2D | `buildPortraitSvg()` vẽ từ `spec.threeD` (giữ đúng tỉ lệ khuôn mặt, màu da/tóc/mắt, trang phục); `STYLE_LOOK` đổi “mood” theo 4 phong cách; `portraitDataUrl()` cho thumbnail, `portraitPng()` xuất PNG |
| `hooks/useLibrary.js` | Thư viện localStorage | Trả về `items`, `has(id)`, `save`, `remove`, `clear`, `toJson`, `importJson`, `filename` (`thu-vien-nhan-vat.json`), `slugify`; bản ghi lưu ở dạng gọn (`slim`: bỏ `description`/`threeD`/`prompt`/`labels`, thêm `savedAt`) và được `finalize()` dựng lại khi hiển thị |
| `api.js` | Cầu nối FastAPI | `api.health/engines/portraitPng/glb/aiPortrait/listLibrary/saveCharacter/deleteCharacter`; lỗi được gói trong `ApiError` với thông báo tiếng Việt; `isServerOnline()` trả `true/false` cho đèn báo |
| `ui/*` | Giao diện | `CreatorForm` (cột trái), `ViewerPanel` + `PortraitPanel` (cột giữa), `InfoPanel` + `LibraryPanel` (cột phải) — tất cả là component thuần, nhận prop và gọi callback |
| `App.jsx` | Bộ khung | Giữ state duy nhất `spec`, `busy`, `toast`, `serverOnline`; điều phối mọi hành động (sinh, lưu, xuất file, gọi API) |

## 4. Vòng đời một nhân vật

```text
1. Người dùng nhập seed (hoặc bấm "Ngẫu nhiên")
2. generateCharacter({ seed, genderId?, occupationId?, style })
     · normalizeSeed()            chuẩn hoá seed
     · createRng(seed)            xmur3 -> mulberry32
     · rút thăm từ tables*.js      danh tính, ngoại hình, trang phục, tính cách, giọng, RPG
     · áp ràng buộc                khoá giới tính / nghề khi người dùng chọn
     · finalize(spec)              thêm nhãn, mô tả, prompt, ba chiều, id
3. spec -> UI (3D, chân dung, hồ sơ, JSON)
4. Người dùng chỉnh 1 ô ngoại hình
     · overrideCharacter(spec, { appearance: { hairStyle: 'bui_to' } })
     · deep-merge + đồng bộ lại trang phục nếu đổi nghề -> finalize() -> id mới
5. Lưu vào thư viện (localStorage) / xuất JSON / xuất GLB / gửi API
```

**Vì sao id được tính lại:** `buildId()` băm `seed` + các trường cốt lõi, nên `id` là “dấu
vân tay” của nhân vật — đổi bất kỳ trường nào là đổi `id` (thư viện nhờ đó không trùng bản
ghi). `id` có dạng `nv-<tên-không-dấu>-<hash 8 ký tự>`.

## 5. Hợp đồng `spec` — chi tiết

`spec` là JSON thuần, có thể lưu file và nạp lại qua `normalizeSpec()`. Cấu trúc đầy đủ (giá
trị ví dụ với seed `NV-DEMO01`):

```jsonc
{
  "schema": 1,
  "seed": "NV-DEMO01",
  "style": "realistic",            // 4 phong cách: realistic | cartoon | ...
  "id": "nv-ly-tue-quan-2925fdbf", // suy ra từ seed + trường cốt lõi
  "updatedAt": "2026-10-15T04:14:31.290Z",

  "identity": {
    "fullName": "Lý Tuệ Quân", "callName": "…", "nameOrigin": "viet",
    "gender": "phi_nhi", "genderLabel": "Phi nhị", "age": 26, "ageStage": "thanh niên",
    "occupation": "dau_bep", "occupationLabel": "Đầu bếp",
    "hometown": "…", "nationality": "Việt Nam"
  },

  "appearance": {                   // nguồn dữ liệu cho cả 3D lẫn chân dung
    "heightCm": 170, "build": "gay", "skinTone": "…", "faceShape": "trai_xoan",
    "hairStyle": "…", "hairColor": "…", "facialHair": "…", "eyeColor": "…"
  },
  "accessory": "khong",

  "outfit": { "style": "chef", "label": "…", "top": "…", "bottom": "…", "shoes": "…", "palette": { } },

  "personality": {
    "archetype": "…", "archetypeLabel": "…",
    "traits": [ ], "likes": [ ], "dislikes": [ ], "motto": "…"
  },

  "voice": { "language": "vi-VN", "ttsVoice": "…", "pitch": 0.98, "speed": 1.02, "timbre": "…" },

  "rpg": { "level": 3, "stats": { "strength": 12, "agility": 14, "intellect": 16,
                                  "empathy": 15, "charm": 13, "tech": 9 } },

  "labels": { },                    // nhãn tiếng Việt của mọi id (để hiển thị / ghi file)
  "description": "…3 đoạn tiếng Việt…",
  "prompt": "Portrait of … (prompt tiếng Anh cho AI vẽ ảnh)",
  "media": { "portrait": null, "glb": null },   // chỗ trống cho ảnh/model sinh ra sau này

  "threeD": {                       // HỢP ĐỒNG CHUNG cho three.js / portrait.js / Blender
    "heightM": 1.7, "gender": "phi_nhi", "age": 26, "ageFactor": 0.18,
    "build": "gay", "mass": 0.76, "width": 0.886,
    "faceRatio": 1.22, "jawWidth": 0.92,
    "skin": "#b5764a", "skinShade": "#8d5730", "hair": "#9aa0a6",
    "hairMesh": "mohawk", "facialHairMesh": "goatee", "eye": "#2f5f8a",
    "top": "#111827", "bottom": "#d97706", "shoes": "#985304", "accent": "#b91c1c",
    "accessoryMesh": "none", "outfitStyle": "chef"
  }
}
```

Quy ước quan trọng của `threeD`:

- **Đơn vị mét**, gốc toạ độ ở chân nhân vật, trục Y hướng lên, mặt nhân vật hướng **+Z**.
- `mass` / `width` là hệ số nhân (1.0 = chuẩn), `faceRatio` / `jawWidth` điều khiển tỉ lệ đầu.
- `*Mesh` là id mesh mà `figure.js` hiểu; thêm mục mới trong `tables*.js` thì phải thêm nhánh
  mesh tương ứng, nếu không nhân vật vẫn dựng được nhưng thiếu chi tiết đó.

## 6. Kiểm thử — chiến lược

| Bộ test | Phạm vi | Vì sao chạy được bằng Node |
| --- | --- | --- |
| `tools/selftest.mjs` | Tất định theo seed, ràng buộc, trường dẫn xuất, tính hợp lệ của bảng lựa chọn | Character Engine là JS thuần, không phụ thuộc DOM |
| `tools/selftest3d.mjs` | `spec.threeD` khớp với ngoại hình (chiều cao, màu, mesh tóc/râu/phụ kiện), không có giá trị `null`/`NaN` | `figure.js` chỉ dùng three.js ở dạng mô-đun, hàm dựng hình tách khỏi WebGL |
| `web/tools/smoke-ui.jsx` | Kết xuất **thật** toàn bộ cây component bằng `react-dom/server`, kiểm tra HTML sinh ra (nhãn, số liệu, SVG chân dung, thumbnail thư viện) | Chỉ WebGL và `useEffect` là không chạy ở chế độ SSR; phần còn lại phản ánh đúng lỗi tiềm ẩn |

Ba bộ này chạy trong vài giây nên dùng được như “lưới an toàn” sau mỗi lần sửa engine/giao
diện. Cách chạy: xem phần **Kiểm thử** trong [../README.md](../README.md).

## 7. Lớp API và lộ trình

`web/src/api.js` là **hợp đồng đã chốt** với backend, gồm 8 endpoint (backend triển khai thêm
endpoint thứ 9 cho DeepSeek):

```text
GET    /health                 -> { status: "ok" }
GET    /api/engines            -> tình trạng Blender + key AI
POST   /api/portrait.png       <- { spec, size }            -> PNG
POST   /api/glb                <- { spec, ...options }      -> GLB (Blender headless)
POST   /api/portrait/ai        <- { spec, ...options }      -> { provider, imageUrl|imageBase64, prompt }
POST   /api/ai/character       <- { spec }                  -> { description, motto, prompt, traits }
GET    /api/library            -> [ nhân vật trên server ]
POST   /api/library            <- { spec }
DELETE /api/library/{id}
```

Backend **đã có trong repo** tại [`api/`](../api/) (FastAPI, cổng `8077`, 209 kiểm thử chạy bằng
`python api/selftest.py`) — xem [api/README.md](../api/README.md) để biết chi tiết endpoint, hai
chế độ nối Blender (headless hoặc addon cầu nối) và xử lý sự cố.

Nguyên tắc đã áp dụng khi viết backend:

1. **Không bắt web phụ thuộc API** — mọi tính năng lõi phải chạy khi API tắt.
2. **Dùng lại `spec.threeD`** làm đầu vào dựng GLB; không định nghĩa tham số song song.
3. **Thứ tự provider AI**: Gemini → MeToken → Pollinations (Pollinations mặc định vì không
   cần key), chọn theo `.env`, có thể tắt bằng `PORTRAIT_ALLOW_POLLINATIONS=false`.
4. Lỗi trả về dạng `{ detail: "thông báo tiếng Việt" }` để web hiển thị thẳng qua toast.

## 8. Gói build & hiệu năng

- `npm run build` cho ra `web/dist` gồm 38 mô-đun, JS ~925 kB (gzip ~254 kB). Phần lớn dung
  lượng là **three.js**; app mới nên giữ nguyên (chưa cần lazy-load), nếu sau này tách trang
  giới thiệu thì có thể `React.lazy` cho `Viewer3D`.
- Chân dung 2D là **SVG sinh cục bộ** (~vài KB text) nên vẽ lại tức thời, không gọi mạng.
- `LibraryPanel` dựng thumbnail bằng `portraitDataUrl(finalize(spec))` trong `useMemo` theo
  `spec`, nên chỉ tính lại khi bản ghi đổi — không lưu ảnh, không phình dung lượng.
- Việc dựng lại figure 3D diễn ra khi `spec.threeD` đổi; mỗi lần dựng đều gọi `dispose()`
  cho geometry/material cũ để tránh rò rỉ bộ nhớ GPU.

## 9. Hạn chế đã biết (có chủ đích ở giai đoạn này)

| Hạn chế | Lý do / hướng xử lý |
| --- | --- |
| Backend `api/` **không chạy trên Vercel** | Web tĩnh vẫn deploy Vercel bình thường; phần Blender/AI phải đặt trên VPS/Docker (xem [TRIEN_KHAI_VERCEL.md](TRIEN_KHAI_VERCEL.md)) |
| Model three.js **không có xương** | Bản trong trình duyệt là model tĩnh + tư thế thở (nhanh, không cần server); muốn xương thì gọi `/api/glb` để Blender dựng bản rig 19 xương |
| Thư viện chỉ nằm trong `localStorage` | Giới hạn dung lượng trình duyệt và tối đa **200 bản ghi** (`MAX_ITEMS`); mất khi xoá dữ liệu duyệt web; bước 6 sẽ đồng bộ lên server |
| Chưa lưu ảnh/GLB vào `spec.media` | Trường `media` đã có sẵn trong card, dành cho bước tích hợp AI/Blender |
| Chưa phát giọng nói (TTS) | `voice` (ttsVoice/timbre/pitch/speed) đã sinh sẵn, chờ bước 5 |
| Seed tối đa 64 ký tự | `normalizeSeed()` cắt bớt để tránh seed rác gây trùng khó kiểm soát |

## 10. Tài liệu liên quan

- [../README.md](../README.md) — tổng quan, cài đặt, chạy, kiểm thử.
- [HUONG_DAN_SU_DUNG.md](HUONG_DAN_SU_DUNG.md) — hướng dẫn dùng giao diện từng bước.
- [../.env.example](../.env.example) — toàn bộ biến cấu hình cho backend/Blender/AI.




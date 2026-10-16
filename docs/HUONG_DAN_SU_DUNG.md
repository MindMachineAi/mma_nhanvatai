# Hướng dẫn sử dụng — MMA NhanVatAI

Dành cho người dùng cuối: cách tạo, chỉnh, xem và lưu nhân vật ảo. Kiến trúc kỹ thuật nằm ở
[KIEN_TRUC.md](KIEN_TRUC.md).

## 1. Cài đặt & mở app

```bash
cd web
npm install
npm run dev
```

Mở trình duyệt tới **http://127.0.0.1:5173**. Lần đầu mở, app tự kiểm tra backend: góc phải
trên hiện **“API đang tắt”** (chấm đỏ) là bình thường — mọi tính năng cơ bản vẫn chạy đủ.

## 2. Giao diện tổng quan

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header: tên app · đèn API [Kiểm tra lại] · [Nhập JSON] [Xuất JSON]           │
├──────────────────┬───────────────────────────────┬───────────────────────────┤
│ CỘT TRÁI         │ CỘT GIỮA                      │ CỘT PHẢI                  │
│ 1. Nguồn sinh    │ Sân khấu 3D (three.js)        │ Hồ sơ / Mô tả / Prompt /  │
│ 2. Ngoại hình    │  + thanh công cụ 3D           │ JSON  (4 tab)             │
│ 3. Nhập/xuất     │ Chân dung 2D (SVG / AI)       │ Thư viện nhân vật         │
├──────────────────┴───────────────────────────────┴───────────────────────────┤
│ Footer: phong cách ảnh · seed hiện tại                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

Mọi thông báo (đã lưu, đã tải file, lỗi…) hiện dưới dạng **toast** ở góc dưới màn hình và tự
tắt sau 4 giây.

## 3. Tạo nhân vật

**Khối “1. Nguồn sinh (seed)” — logic quan trọng nhất của app:**

| Thao tác | Kết quả |
| --- | --- |
| Gõ seed (VD `NV-DEMO01`) rồi bấm **Sinh lại** (hoặc Enter) | Sinh lại **đúng** nhân vật của seed đó, dù đã đổi ngoại hình thế nào |
| Bấm **Ngẫu nhiên** | Tạo seed mới dạng `NV-XXXXXX` và sinh nhân vật mới |
| Chọn **Giới tính** / **Nghề nghiệp** (*khoá khi sinh*) | Khoá tiêu chí đó; bấm *Sinh lại* để áp dụng. Chọn “Ngẫu nhiên” để thả tự do |
| Chọn **Phong cách ảnh** | Đổi “mood” của chân dung SVG và prompt AI (4 phong cách) |

> **Mẹo:** seed + ràng buộc chính là “công thức” của nhân vật. Muốn tái tạo y hệt ở máy khác,
> chỉ cần seed (và giữ nguyên ràng buộc giới tính/nghề nếu đã khoá).

## 4. Chỉnh ngoại hình

Khối **“2. Ngoại hình”** — mọi ô đều cập nhật **tức thời** cả 3D lẫn chân dung:

- **Chiều cao**: thanh trượt 140–210 cm (hiện kèm số mét).
- **Vóc dáng** (5 lựa chọn), **Dáng mặt** (6) — đổi tỉ lệ cơ thể và khuôn mặt.
- **Màu da** (5), **Màu mắt** (6), **Màu tóc** (12) — ô chọn có kèm ô vuông màu + mã hex.
- **Kiểu tóc** (12), **Râu / mặt** (5), **Phụ kiện** (12).

Sau khi chỉnh, `id` nhân vật đổi theo — nên bản đã lưu trước đó vẫn giữ nguyên, còn bản đang
xem là một nhân vật mới (bấm *Lưu vào thư viện* nếu muốn cất bản mới).

## 5. Xem và kết xuất 3D (cột giữa)

- **Điều khiển**: kéo chuột trái để xoay, lăn chuột để phóng, kéo chuột phải để dịch chuyển.
- **Tư thế tĩnh / Đang động**: tắt/bật chuyển động thở nhẹ của nhân vật.
- **Camera mặc định**: đưa camera về khung hình chuẩn (dùng khi bị lạc hướng).
- **Lưới (wireframe)**: xem dạng lưới để kiểm tra hình khối.
- **Chụp ảnh PNG**: lưu ảnh khung hình 3D hiện tại.
- **Tải GLB (nhanh)**: xuất model GLB **ngay trong trình duyệt**, không cần server — dùng để
  mang sang game/engine khác.
- **Dựng bằng Blender**: gọi backend Blender dựng GLB chi tiết hơn. Khi API tắt, nút này báo
  lỗi và hướng dẫn bật server. Nếu đã có model Blender, khung xem chuyển sang model đó và
  hiện nhãn “Đang xem model Blender” kèm nút **×** để quay về bản three.js tức thời.

## 6. Chân dung 2D (dưới sân khấu 3D)

- Ảnh hiển thị là **SVG sinh từ chính tham số 3D** → luôn khớp nhân vật đang xem, không tốn
  lượt gọi AI, không cần mạng.
- **4 chip phong cách** ở cột trái (khối Nguồn sinh) và ngay trong panel này đổi kiểu vẽ.
- **Tải SVG**: ảnh vector, phóng to không vỡ — hợp để in hoặc đưa vào tài liệu.
- **Tải PNG**: ảnh raster tiện chia sẻ nhanh.
- **Nâng cấp bằng AI** / **Vẽ lại bằng AI**: chỉ chạy khi backend đã bật. Ảnh AI (kèm tên nhà
  cung cấp) sẽ thay thế bản SVG cho tới khi bấm **Xoá ảnh AI**.

## 7. Hồ sơ nhân vật (cột phải — 4 tab)

| Tab | Nội dung |
| --- | --- |
| **Hồ sơ** | Nút *Lưu vào thư viện* (hiện “✓ Đã lưu vào thư viện” nếu bản này đã có trong thư viện), thông tin cá nhân (họ tên, tên gọi, giới tính · tuổi · giai đoạn, nghề, quê quán, ngoại hình, trang phục, phụ kiện, archetype, câu nói, thích/không thích, giọng nói, cấp độ) và **6 thanh chỉ số** thang 0–20: Sức mạnh, Nhanh nhẹn, Trí tuệ, Đồng cảm, Sức hút, Công nghệ |
| **Mô tả** | Mô tả tiếng Việt 3 đoạn, đọc tự nhiên — dùng để viết tiểu sử, kịch bản, hội thoại. Nút *Copy mô tả* |
| **Prompt AI** | Prompt tiếng Anh (ảnh hưởng bởi “Phong cách ảnh”). Nút *Copy prompt* — dán vào Midjourney/Stable Diffusion/DALL·E đều dùng được |
| **JSON** | Toàn bộ character card (đẹp, thụt lề). Nút *Copy JSON* và *Tải .json* |

## 8. Thư viện nhân vật

| Nút | Công dụng |
| --- | --- |
| **Lưu bản hiện tại** | Cất nhân vật đang xem vào thư viện. Lưu cùng `id` sẽ **ghi đè** bản cũ (cập nhật) |
| **Nhập** | Nạp file JSON do nút *Xuất* tạo ra (cả bộ) **hoặc** một character card đơn lẻ. Bản ghi trùng `id` sẽ được cập nhật thay vì thêm trùng |
| **Xuất** | Tải toàn bộ thư viện thành 1 file JSON tên `thu-vien-nhan-vat.json` để sao lưu hoặc chuyển máy |
| **Xoá hết** | Xoá sạch thư viện **trong trình duyệt này** (không hoàn tác được) |
| Bấm vào một dòng | Mở lại nhân vật đó (kèm đúng seed, nên mọi thứ khôi phục y như cũ) |
| Nút **×** trên dòng | Xoá riêng nhân vật đó |

Ảnh nhỏ (thumbnail) trong thư viện được **dựng lại từ dữ liệu nhân vật** mỗi lần hiển thị, nên
thư viện không lưu ảnh và không chiếm dung lượng lớn.

## 9. Nhập / xuất file

- **Xuất JSON** (header hoặc khối 3 cột trái): tải **character card** của nhân vật đang xem —
  file này đủ để tái tạo 100% nhân vật (cùng seed, cùng tham số).
- **Nhập JSON**: chọn card đã xuất trước đó ⇒ app nạp lại nhân vật và tính lại mọi trường dẫn
  xuất. File lạ (không phải card của app) sẽ bị từ chối kèm thông báo tiếng Việt rõ ràng.
- **Tải GLB (nhanh)**: model 3D xuất trực tiếp từ three.js — mở được bằng Blender, Unity,
  Unreal, Godot, Windows 3D Viewer…
- **Tải SVG / PNG**: ảnh chân dung (xem mục 6).

## 10. Bật backend API (tuỳ chọn — đã có trong repo ở `api/`)

Web dùng được đầy đủ khi API tắt, nhưng bật lên thì có thêm: GLB dựng bằng **Blender có rig**,
chân dung PNG nét dày, ảnh AI chất lượng cao và thư viện nhân vật trên server.

1. Cài phụ thuộc Python (một lần):
   ```bash
   pip install -r api/requirements.txt
   ```
2. Copy `.env.example` → `.env` ở **gốc repo**, điền `GEMINI_API_KEY` hoặc `METOKEN_API_KEY` nếu có
   (không điền vẫn dùng được Pollinations miễn phí), `DEEPSEEK_API_KEY` nếu muốn AI viết lại prompt,
   và `BLENDER_PATH` nếu Blender cài ở chỗ khác.
3. Chạy server **từ gốc repo**:
   ```bash
   python -m uvicorn api.main:app --port 8077
   ```
4. Quay lại app, bấm **Kiểm tra lại** ở header — chấm chuyển xanh **“API đã bật”**, nút
   **Dựng bằng Blender** và **Nâng cấp bằng AI** được mở khoá.

Muốn nhân vật hiện ngay trong **Blender đang mở** (sửa tay, export thêm FBX/`.blend`) thì cài addon
`api/blender_addon/mma_bridge.py` rồi bật cầu nối trong tab **MMA Bridge** (N ▸ Sidebar).

Web dev gọi API ở `http://127.0.0.1:8077`; muốn đổi địa chỉ thì đặt biến `VITE_API_BASE`
(xem `.env.example`). Chi tiết endpoint, biến môi trường và xử lý sự cố: **`api/README.md`**.

## 11. Mẹo & xử lý sự cố

| Hiện tượng | Cách xử lý |
| --- | --- |
| Khung 3D trắng/đen, không thấy nhân vật | Kiểm tra trình duyệt có bật WebGL2 (`chrome://gpu`), thử tắt tiện ích chặn script rồi tải lại trang |
| Nút AI / Blender bị mờ, báo lỗi kết nối | Bình thường khi **API đang tắt** — bật backend rồi bấm *Kiểm tra lại* |
| Nhân vật khác so với lần trước | Seed hoặc ràng buộc (giới tính/nghề) đã khác, hoặc đã chỉnh ngoại hình — `id` đổi là dấu hiệu |
| Muốn “quay lại” nhân vật cũ | Mở lại đúng dòng trong **Thư viện**, hoặc `Nhập JSON` card đã xuất |
| Mất thư viện sau khi xoá dữ liệu duyệt web | Dùng *Xuất* để sao lưu định kỳ; bước 6 của lộ trình sẽ đồng bộ lên server |
| App chạy chậm khi kéo thanh chiều cao liên tục | Nhân vật 3D dựng lại theo từng bước thay đổi — thả chuột để dừng cập nhật |

README tổng quan: [../README.md](../README.md) · Kiến trúc kỹ thuật: [KIEN_TRUC.md](KIEN_TRUC.md)


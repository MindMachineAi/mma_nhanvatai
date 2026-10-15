# Triển khai lên Vercel — MMA NhanVatAI

Tài liệu này hướng dẫn cách "khai báo" để Vercel build đúng thư mục `web/` và xuất bản web tĩnh.
Đối tượng: người đã có quyền vào repo `MindMachineAi/mma_nhanvatai` trên GitHub.

## Điểm cần biết trước khi bắt đầu

| Sự thật về repo này | Hệ quả khi deploy |
| --- | --- |
| Mã web nằm trong thư mục con `web/`, **gốc repo không có `package.json`** | Vercel không tự nhận ra đây là dự án Vite → phải chỉ rõ `install/build/output` trỏ vào `web/` |
| Vite cấu hình `outDir: 'dist'` (tính theo `web/`) | Thư mục xuất bản là **`web/dist`** khi chạy build từ gốc repo |
| Ứng dụng chỉ có **một route** (`index.html` → `main.jsx`, không dùng `react-router`) | **Không cần** rewrite SPA; chỉ thêm `"rewrites"` nếu sau này bạn thêm router |
| `web/dist/` **không** được commit (nằm trong `.gitignore`) | Bình thường — Vercel tự chạy `npm run build` trên máy chủ của họ |
| Backend FastAPI (`api/`) **chưa có trong repo**, và bản kế hoạch cần **Blender headless** | Vercel **không** chạy được Blender ⇒ chỉ deploy web; xem mục 5 |
| Web đọc biến môi trường **lúc build** (`import.meta.env.VITE_API_BASE`) | Đổi biến phải **redeploy** mới có tác dụng (không phải tự động như biến runtime) |

Kiểm tra nhanh trên máy trước khi deploy (phải chạy được, đây là điều Vercel sẽ làm lại):

```bash
cd web
npm install
npm run build     # sinh ra web/dist/
npm run preview   # mở http://localhost:4173 để xem bản build
```

## Cách A — Import từ GitHub (khuyến nghị, đã có `vercel.json`)

1. Vào [vercel.com](https://vercel.com) → đăng nhập bằng tài khoản GitHub có quyền với
   `MindMachineAi/mma_nhanvatai` → **Add New… → Project**.
2. Ở **Import Git Repository**, chọn repo `mma_nhanvatai` → bấm **Import**.
3. Ở màn **Configure Project**, giữ nguyên như bảng dưới. Vì repo đã có `vercel.json`, Vercel sẽ
   tự đọc 3 ô lệnh; nếu giao diện hiển thị giá trị khác (do auto-detect), cứ sửa lại cho khớp:

   | Ô cấu hình | Giá trị |
   | --- | --- |
   | Project Name | `mma-nhanvatai` (hoặc tên bạn muốn → thành `https://<tên>.vercel.app`) |
   | Framework Preset | `Other` |
   | **Root Directory** | *(để trống = gốc repo)* |
   | Build and Output Settings | bấm mở, chọn **Override** rồi điền 3 dòng dưới |
   | Install Command | `cd web && npm install` |
   | Build Command | `cd web && npm run build` |
   | Output Directory | `web/dist` |
   | Environment Variables | `VITE_API_BASE` — **tuỳ chọn**, xem mục 5 (mặc định: bỏ trống) |
   | Node.js Version | `22.x` — yêu cầu của Vite 8.3 là Node `^20.19.0 \|\| >=22.12.0` (Settings → General) |

4. Bấm **Deploy**. Lần đầu thường 1–3 phút (tải three.js + build Vite).
5. Sau khi xong, Vercel trả URL kiểu `https://mma-nhanvatai.vercel.app` và tự bật:
   - mọi lần `git push` lên `main` → **Production Deployment**;
   - pull request / nhánh khác → **Preview Deployment** riêng.

> Vercel ưu tiên cấu hình trong `vercel.json` hơn các ô trong giao diện. Muốn điều khiển hoàn
> toàn bằng dashboard thì xoá `vercel.json` (xem Cách B).

## Cách B — Đặt Root Directory là `web/`

Cách này không dùng `vercel.json` ở gốc repo (Vercel chỉ đọc `vercel.json` ngay trong Root
Directory, nên file ở gốc sẽ bị bỏ qua):

1. Làm như Cách A tới bước 3, nhưng điền **Root Directory = `web`** (bấm *Edit*).
2. Vercel tự nhận Framework Preset = **Vite**, để mặc định:
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. **Deploy**.

Chọn A hay B tuỳ sở thích; A giữ cấu hình trong repo (ai clone về cũng deploy được y hệt), B gọn
hơn khi bạn chỉ muốn sửa trên giao diện web.

## Cách C — Deploy bằng CLI (khi không muốn bấm giao diện)

```powershell
# Trong gốc repo mma_nhanvatai (nơi có vercel.json)
npx vercel login          # đăng nhập (GitHub/Email)
npx vercel link           # chọn scope MindMachineAi + tạo/ghép project mma-nhanvatai
npx vercel                # deploy bản PREVIEW (URL tạm)
npx vercel --prod         # deploy bản PRODUCTION (URL chính)
```

Lần chạy đầu CLI hỏi vài thông tin; cứ để mặc định vì `vercel.json` đã khai báo lệnh build.
Kết quả: CLI in ra URL preview/production ngay trong terminal.

## 5. Biến môi trường & chuyện backend

Web đọc `VITE_API_BASE` từ `web/src/api.js` theo kiểu `import.meta.env.VITE_API_BASE`. Vite
**nhúng giá trị này vào bundle lúc build**, vì vậy:

- Đặt biến ở Vercel: **Project → Settings → Environment Variables** → `VITE_API_BASE` =
  URL backend công khai (vd `https://api.mma-nhanvatai.com`), chọn cả 3 môi trường
  (Production / Preview / Development) → sau đó **Redeploy** (Deployments → ⋯ → Redeploy).
- **Đừng** đặt `http://127.0.0.1:8077` hay `http://localhost:8077` trên Vercel: trình duyệt của
  người xem sẽ hiểu đó là **máy của họ**, nên đèn API sẽ đỏ và các nút AI/Blender bị khoá.
- Bỏ trống biến này là an toàn nhất: web chạy ở **chế độ offline đầy đủ** — sinh nhân vật theo
  seed, xem 3D (three.js), chân dung SVG (`portrait.js`), thư viện `localStorage`, xuất
  JSON/character card/GLB đều chạy 100% trong trình duyệt.

Về backend trên Vercel: **không deploy được** phần dựng GLB bằng Blender vì máy dựng của Vercel
không cài Blender, thời lượng function bị giới hạn (Hobby: tối đa 60 giây) và ổ đĩa chỉ đọc.
Cách làm đúng:

| Phần backend | Nên đặt ở đâu |
| --- | --- |
| `api/` FastAPI + Blender (`/api/glb`) | VPS / Render / Railway / Fly.io (có Docker + Blender headless) |
| `/api/portrait/ai` (gọi Gemini → MeToken → Pollinations) | Có thể chạy serverless (Vercel Python/Node) **nếu API key để trong Environment Variables**, hoặc cùng VPS trên |
| Thư viện nhân vật trên server (bước 6 roadmap) | Nơi có DB (Neon/Supabase/VPS) |

Nếu backend nằm ở domain khác, nhớ bật CORS cho domain `*.vercel.app` (và domain riêng của bạn).

## 6. Kiểm tra sau khi deploy

1. Mở URL production → tab **Nhân vật** hiện ra, không có lỗi đỏ trong Console (F12).
2. Bấm **Tạo nhân vật mới**, xem khung 3D xoay/kéo được, thử *Tải GLB* và *Tải JSON*.
3. Bấm **Lưu** → mở tab **Thư viện** → tải lại trang (F5) → nhân vật vẫn còn
   (dữ liệu nằm trong `localStorage` của chính trình duyệt).
4. Kiểm tra nhanh phần tài nguyên: tab **Network** chỉ nên có các file trong `/assets/…` trả 200.
5. Vào **Deployments** xem log build: dòng cuối phải có `build` + `Deploying outputs` thành công;
   phần *Output Directory* phải ghi `web/dist`.

Kích thước bản build đo trên máy dev (để bạn biết thế nào là bình thường, không phải lỗi):
`index.html` ~0.6 kB, CSS ~11 kB, JS ~925 kB (gzip ~254 kB) — phần lớn là **three.js**.

## 7. Xử lý sự cố thường gặp

| Thông báo / triệu chứng | Nguyên nhân & cách sửa |
| --- | --- |
| `No Output Directory named "dist" found` | Bạn để Root Directory trống nhưng Output Directory chưa phải `web/dist` (hoặc ngược lại: Root = `web` mà lại điền `web/dist` → phải là `dist`) |
| `sh: vite: not found` / `vite: command not found` | Install Command chưa trỏ vào `web/` → dùng `cd web && npm install` |
| Build OK nhưng mở trang trắng | Thường do WebGL bị chặn (thử Chrome/Edge, bật hardware acceleration) hoặc asset 404 — xem Console/Network |
| 3D không hiện, canvas trống | Kiểm tra GPU/driver; app cần WebGL2. Thử máy khác để loại trừ |
| Đèn API đỏ, nút AI mờ | Web không gọi được backend: chưa đặt `VITE_API_BASE`, hoặc trỏ vào localhost (xem mục 5) |
| Đổi biến môi trường nhưng web không thấy | Vite nhúng biến lúc build → phải **Redeploy** |
| Lỗi engine Node khi build | **Settings → General → Node.js Version** chọn `22.x` (Vite 8 cần Node `^20.19.0` hoặc `>=22.12.0`), rồi redeploy |
| Muốn Vercel dùng cấu hình giao diện thay vì file | Sửa/xoá `vercel.json` ở gốc repo rồi commit (vercel.json luôn được ưu tiên) |

## 8. Ghi chú thêm

- **Domain riêng**: Project → Settings → Domains → *Add*, rồi trỏ CNAME về `cname.vercel-dns.com`.
- **Nhánh production**: mặc định là `main`. Đổi ở Settings → Git → Production Branch.
- **URL có tiền tố con** (vd `example.com/nhanvatai/`): phải thêm `base: '/nhanvatai/'` vào
  `web/vite.config.js` rồi build lại — hiện app giả định chạy ở gốc tên miền nên `base` đang là mặc định `/`.
- **Nếu sau này thêm `react-router`**: thêm vào `vercel.json`
  `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]` để F5 ở route con không 404.
- **Bảo mật**: không commit API key vào repo; mọi khoá (Blender/Gemini/MeToken) chỉ để trong
  Environment Variables của nơi chạy backend.

## Tóm tắt 3 dòng

1. Repo đã có `vercel.json` → import repo trên Vercel, để **Root Directory trống**, bấm Deploy.
2. `install/build/output` lần lượt là `cd web && npm install`, `cd web && npm run build`, `web/dist`.
3. `VITE_API_BASE` để trống nếu chỉ dùng web tĩnh; backend Blender/AI phải nằm trên máy chủ khác.


/**
 * tables2.js — Bảng dữ liệu mở rộng: nghề nghiệp, trang phục, phụ kiện,
 * tên người, nguyên mẫu tính cách, câu chuyện nền, preset phong cách.
 * Tách khỏi tables.js để file gọn, dễ mở rộng.
 */

// ── Bộ trang phục ───────────────────────────────────────────
export const OUTFITS = {
  casual: {
    label: 'Thường ngày',
    top: 'Áo thun',
    bottom: 'Quần jeans',
    shoes: 'Giày sneaker',
    palette: ['#3b82f6', '#111827', '#f5f5f5', '#ef4444', '#16a34a'],
  },
  office: {
    label: 'Công sở',
    top: 'Sơ mi',
    bottom: 'Quần âu',
    shoes: 'Giày tây',
    palette: ['#1e3a8a', '#0f172a', '#e5e7eb', '#7f1d1d', '#334155'],
  },
  formal: {
    label: 'Trang trọng',
    top: 'Vest',
    bottom: 'Quần vest',
    shoes: 'Giày da',
    palette: ['#111827', '#1f2937', '#4b5563', '#0b3d2e', '#3f2a56'],
  },
  sport: {
    label: 'Thể thao',
    top: 'Áo tập',
    bottom: 'Quần short',
    shoes: 'Giày chạy',
    palette: ['#ef4444', '#0ea5e9', '#facc15', '#111827', '#22c55e'],
  },
  uniform: {
    label: 'Đồng phục',
    top: 'Áo đồng phục',
    bottom: 'Quần đồng phục',
    shoes: 'Giày đồng phục',
    palette: ['#1d4ed8', '#0f766e', '#7c2d12', '#1f2937', '#065f46'],
  },
  traditional: {
    label: 'Truyền thống',
    top: 'Áo dài',
    bottom: 'Quần lụa',
    shoes: 'Guốc mộc',
    palette: ['#b91c1c', '#f59e0b', '#0e7490', '#7e22ce', '#065f46'],
  },
  techwear: {
    label: 'Techwear',
    top: 'Áo khoác kỹ thuật',
    bottom: 'Quần cargo',
    shoes: 'Boots',
    palette: ['#111827', '#374151', '#4d7c0f', '#0369a1', '#a16207'],
  },
  medical: {
    label: 'Y tế',
    top: 'Blouse y tế',
    bottom: 'Quần scrub',
    shoes: 'Giày y tế',
    palette: ['#e0f2fe', '#0ea5e9', '#0f766e', '#f8fafc', '#1e40af'],
  },
  chef: {
    label: 'Đầu bếp',
    top: 'Áo bếp',
    bottom: 'Tạp dề',
    shoes: 'Giày bếp',
    palette: ['#f8fafc', '#111827', '#b91c1c', '#374151', '#d97706'],
  },
  safety: {
    label: 'Bảo hộ lao động',
    top: 'Áo phản quang',
    bottom: 'Quần BHLĐ',
    shoes: 'Ủng bảo hộ',
    palette: ['#f97316', '#facc15', '#1f2937', '#0f766e', '#e5e7eb'],
  },
  artist: {
    label: 'Nghệ sĩ',
    top: 'Áo vải thô',
    bottom: 'Quần túi hộp',
    shoes: 'Dép vải',
    palette: ['#7e22ce', '#c2410c', '#0f766e', '#422006', '#eab308'],
  },
  gamer: {
    label: 'Streamer',
    top: 'Hoodie',
    bottom: 'Quần jogger',
    shoes: 'Sneaker',
    palette: ['#7c3aed', '#0ea5e9', '#111827', '#db2777', '#22d3ee'],
  },
};

// ── Nghề nghiệp (kèm gợi ý prompt cho AI vẽ chân dung) ──────
export const OCCUPATIONS = [
  { id: 'ky_su_bim', label: 'Kỹ sư BIM', outfit: 'safety', hint: 'hi-vis vest, hard hat, tablet showing a 3D model', traits: ['tỉ mỉ', 'logic', 'kiên nhẫn'] },
  { id: 'kien_truc_su', label: 'Kiến trúc sư', outfit: 'office', hint: 'rolled-up sleeves, blueprint tube, sketchbook', traits: ['sáng tạo', 'thẩm mỹ', 'cầu toàn'] },
  { id: 'lap_trinh_vien', label: 'Lập trình viên', outfit: 'casual', hint: 'hoodie, laptop, headphones around neck', traits: ['logic', 'tò mò', 'tập trung cao'] },
  { id: 'bac_si', label: 'Bác sĩ', outfit: 'medical', hint: 'white coat, stethoscope, calm eyes', traits: ['điềm tĩnh', 'tận tâm', 'quyết đoán'] },
  { id: 'y_ta', label: 'Y tá', outfit: 'medical', hint: 'scrubs, caring expression', traits: ['nhẹ nhàng', 'kiên nhẫn', 'chu đáo'] },
  { id: 'giao_vien', label: 'Giáo viên', outfit: 'office', hint: 'chalk-dusted hands, friendly smile, marker', traits: ['kiên nhẫn', 'truyền cảm hứng', 'công bằng'] },
  { id: 'dau_bep', label: 'Đầu bếp', outfit: 'chef', hint: 'chef whites, kitchen towel on shoulder', traits: ['nhanh nhẹn', 'sáng tạo', 'kỷ luật'] },
  { id: 'cong_an', label: 'Công an', outfit: 'uniform', hint: 'police uniform, upright posture', traits: ['kỷ luật', 'dũng cảm', 'công tâm'] },
  { id: 'linh_cuu_hoa', label: 'Lính cứu hoả', outfit: 'safety', hint: 'firefighter gear, soot on cheek', traits: ['gan dạ', 'hy sinh', 'nhanh trí'] },
  { id: 'phi_cong', label: 'Phi công', outfit: 'uniform', hint: 'aviator uniform with epaulettes', traits: ['bình tĩnh', 'tự tin', 'chính xác'] },
  { id: 'huong_dan_vien', label: 'Hướng dẫn viên du lịch', outfit: 'casual', hint: 'sun hat, backpack, cheerful energy', traits: ['hoạt ngôn', 'thân thiện', 'hiểu biết'] },
  { id: 'nhan_vien_ngan_hang', label: 'Nhân viên ngân hàng', outfit: 'formal', hint: 'crisp shirt, customer-service smile', traits: ['chỉn chu', 'đáng tin', 'giao tiếp tốt'] },
  { id: 'streamer', label: 'Streamer', outfit: 'gamer', hint: 'gaming hoodie, RGB desk lighting, headset', traits: ['hài hước', 'phản xạ nhanh', 'sáng tạo nội dung'] },
  { id: 'nhiep_anh_gia', label: 'Nhiếp ảnh gia', outfit: 'casual', hint: 'camera strap, casual layers', traits: ['quan sát tốt', 'kiên nhẫn', 'tinh tế'] },
  { id: 'hoa_si', label: 'Hoạ sĩ', outfit: 'artist', hint: 'paint-stained apron, beret', traits: ['giàu cảm xúc', 'tưởng tượng', 'bứt phá'] },
  { id: 'luat_su', label: 'Luật sư', outfit: 'formal', hint: 'suit, folder of documents', traits: ['lập luận sắc', 'cẩn trọng', 'tự tin'] },
  { id: 'ke_toan', label: 'Kế toán', outfit: 'office', hint: 'neat shirt, glasses, calculator', traits: ['chính xác', 'ngăn nắp', 'kín đáo'] },
  { id: 'vo_si_mma', label: 'Võ sĩ MMA', outfit: 'sport', hint: 'athletic build, hand wraps', traits: ['bền bỉ', 'kỷ luật', 'lì đòn'] },
  { id: 'ca_si', label: 'Ca sĩ', outfit: 'formal', hint: 'stage outfit, confident pose', traits: ['cuốn hút', 'giàu cảm xúc', 'bản lĩnh sân khấu'] },
  { id: 'mc', label: 'MC', outfit: 'formal', hint: 'elegant blazer, handheld microphone', traits: ['hoạt ngôn', 'duyên dáng', 'ứng biến giỏi'] },
  { id: 'nong_dan', label: 'Nông dân', outfit: 'safety', hint: 'straw hat, rolled trousers, sun-weathered skin', traits: ['chăm chỉ', 'gắn bó đất', 'thật thà'] },
  { id: 'tai_xe_cong_nghe', label: 'Tài xế công nghệ', outfit: 'casual', hint: 'app-driver jacket, helmet in hand', traits: ['đúng giờ', 'thạo đường phố', 'thân thiện'] },
  { id: 'shipper', label: 'Shipper', outfit: 'safety', hint: 'delivery backpack, rain jacket', traits: ['nhanh nhẹn', 'chịu áp lực', 'kiên trì'] },
  { id: 'tho_may', label: 'Thợ may', outfit: 'artist', hint: 'measuring tape around neck, thimble', traits: ['khéo tay', 'tỉ mỉ', 'kiên nhẫn'] },
  { id: 'nha_nghien_cuu', label: 'Nhà nghiên cứu AI', outfit: 'office', hint: 'glasses, notebooks, whiteboard behind', traits: ['tư duy sâu', 'kiên trì', 'ham học'] },
  { id: 'kinh_doanh', label: 'Nhân viên kinh doanh', outfit: 'office', hint: 'blazer, business cards, confident handshake', traits: ['nhiệt huyết', 'thuyết phục', 'chịu áp lực'] },
];

// ── Phụ kiện (mỗi id có mesh tương ứng trong figure.js) ─────
export const ACCESSORIES = [
  { id: 'khong', label: 'Không', mesh: 'none' },
  { id: 'kinh_can', label: 'Kính cận', mesh: 'glasses' },
  { id: 'kinh_ram', label: 'Kính râm', mesh: 'sunglasses' },
  { id: 'mu_luoi_trai', label: 'Mũ lưỡi trai', mesh: 'cap' },
  { id: 'mu_rong_vang', label: 'Mũ rộng vành', mesh: 'sunhat' },
  { id: 'mu_bao_ho', label: 'Mũ bảo hộ', mesh: 'hardhat' },
  { id: 'tai_nghe', label: 'Tai nghe', mesh: 'headset' },
  { id: 'khuyen_tai', label: 'Khuyên tai', mesh: 'earring' },
  { id: 'day_chuyen', label: 'Dây chuyền', mesh: 'necklace' },
  { id: 'khan_quang', label: 'Khăn quàng', mesh: 'scarf' },
  { id: 'ba_lo', label: 'Ba lô', mesh: 'backpack' },
  { id: 'dong_ho', label: 'Đồng hồ', mesh: 'watch' },
];

// ── Quê quán ────────────────────────────────────────────────
export const HOMETOWNS = [
  'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Huế',
  'Nha Trang', 'Đà Lạt', 'Buôn Ma Thuột', 'Quy Nhơn', 'Vinh', 'Hạ Long',
  'Biên Hoà', 'Mỹ Tho', 'Pleiku', 'Rạch Giá', 'Bắc Ninh', 'Nam Định',
];

// ── Tên người Việt (mặc định) + tên quốc tế ─────────────────
export const NAME_POOL = {
  ho: ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Trịnh', 'Đinh', 'Tạ', 'Mai'],
  nam: {
    dem: ['Văn', 'Hữu', 'Minh', 'Quang', 'Đức', 'Tuấn', 'Hoàng', 'Gia', 'Nhật', 'Thành', 'Bảo', 'Khánh'],
    ten: ['An', 'Bình', 'Cường', 'Dũng', 'Duy', 'Hải', 'Hùng', 'Khang', 'Kiệt', 'Lâm', 'Long', 'Mạnh', 'Nam', 'Nghĩa', 'Phúc', 'Quân', 'Sơn', 'Tâm', 'Thắng', 'Trí', 'Tuấn', 'Vinh', 'Khôi', 'Phát'],
  },
  nu: {
    dem: ['Thị', 'Ngọc', 'Thanh', 'Thu', 'Minh', 'Khánh', 'Phương', 'Diệu', 'Hồng', 'Bích', 'Tuệ', 'Gia'],
    ten: ['Anh', 'Chi', 'Dung', 'Giang', 'Hà', 'Hân', 'Hiền', 'Hoa', 'Hương', 'Lan', 'Linh', 'Ly', 'Mai', 'My', 'Nga', 'Ngân', 'Nhung', 'Nhi', 'Quỳnh', 'Thảo', 'Trang', 'Vân', 'Yến', 'Thư', 'Nhiên'],
  },
  trung_tinh: {
    dem: ['Minh', 'An', 'Thanh', 'Khánh', 'Bảo', 'Gia', 'Tuệ'],
    ten: ['An', 'Bảo', 'Bình', 'Duy', 'Hà', 'Khánh', 'Linh', 'Minh', 'Nam', 'Nhiên', 'Phong', 'Quân', 'Tâm', 'Thiên', 'Trúc', 'Vân'],
  },
  quoc_te: {
    ho: ['Kim', 'Park', 'Lee', 'Chen', 'Sato', 'Ng', 'Smith', 'Garcia'],
    nam: ['Jun', 'Kai', 'Leo', 'Noah', 'Ravi', 'Yuki', 'Arun', 'Daniel'],
    nu: ['Mina', 'Aria', 'Lina', 'Sora', 'Chloe', 'Nina', 'Amara', 'Yuna'],
  },
};


// ── Nguyên mẫu tính cách ────────────────────────────────────
export const ARCHETYPES = [
  { id: 'truyen_cam_hung', label: 'Người truyền cảm hứng', traits: ['lạc quan', 'nhiệt huyết', 'truyền lửa', 'cởi mở'] },
  { id: 'phan_tich', label: 'Nhà phân tích', traits: ['logic', 'điềm tĩnh', 'chính xác', 'ít nói'] },
  { id: 'thu_linh', label: 'Thủ lĩnh', traits: ['quyết đoán', 'trách nhiệm', 'tầm nhìn', 'công bằng'] },
  { id: 'nghe_si', label: 'Tâm hồn nghệ sĩ', traits: ['giàu cảm xúc', 'tưởng tượng', 'bốc đồng', 'tinh tế'] },
  { id: 'hau_can', label: 'Người hậu cần', traits: ['chu đáo', 'kiên nhẫn', 'đáng tin', 'hy sinh'] },
  { id: 'noi_loan', label: 'Kẻ nổi loạn', traits: ['thẳng thắn', 'bất quy tắc', 'dũng cảm', 'nóng tính'] },
  { id: 'tri_gia', label: 'Bậc trí giả', traits: ['sâu sắc', 'kiên nhẫn', 'ham học', 'khiêm tốn'] },
  { id: 'hoat_ngon', label: 'Người hoạt ngôn', traits: ['hài hước', 'thân thiện', 'nhanh trí', 'hướng ngoại'] },
];

// ── Kho từ mô tả tính cách ──────────────────────────────────
export const TRAITS = [
  'lạc quan', 'điềm tĩnh', 'quyết đoán', 'tỉ mỉ', 'sáng tạo', 'kiên nhẫn',
  'trung thực', 'hài hước', 'chăm chỉ', 'tò mò', 'thẳng thắn', 'nhạy cảm',
  'cầu toàn', 'khiêm tốn', 'hướng ngoại', 'hướng nội', 'dũng cảm', 'giàu cảm xúc',
  'logic', 'thực tế', 'lãng mạn', 'kỷ luật', 'ứng biến tốt', 'biết lắng nghe',
];

// ── Sở thích / không thích ──────────────────────────────────
export const LIKES = [
  'cà phê sáng sớm', 'chạy bộ ven sông', 'đọc sách giấy', 'nghe nhạc lo-fi',
  'nấu ăn cho gia đình', 'chụp ảnh phố đêm', 'chơi game chiến thuật',
  'du lịch bụi', 'vẽ ký hoạ', 'tập gym', 'trồng cây ban công', 'xem phim tài liệu',
  'học ngoại ngữ', 'sửa đồ điện tử', 'yoga', 'bơi lội', 'chơi cờ', 'viết nhật ký',
];

export const DISLIKES = [
  'sự giả tạo', 'họp hành vô nghĩa', 'tiếng ồn quá mức', 'sự trì hoãn',
  'đồ ăn quá cay', 'sự bất công', 'thời tiết ẩm ướt', 'người thiếu tôn trọng',
  'mất kết nối internet', 'sự cẩu thả', 'nói dối', 'chờ đợi vô ích',
];

// ── Châm ngôn sống ──────────────────────────────────────────
export const MOTTOS = [
  'Làm tới cùng, nghỉ tới nơi.',
  'Chậm mà chắc, chắc mà xa.',
  'Học một, biết mười.',
  'Việc hôm nay chớ để mai.',
  'Tử tế là một dạng thông minh.',
  'Không có đường tắt cho sự tử tế.',
  'Cứ đi, đường sẽ thành.',
  'Thử thách là học phí của sự trưởng thành.',
  'Bình tĩnh sẽ thấy lối ra.',
  'Cái gì làm được hôm nay thì đừng hẹn ngày mai.',
];

// ── Giọng nói (phục vụ TTS ở bước sau) ──────────────────────
export const TTS_VOICES = [
  { id: 'vi-VN-HoaiMyNeural', label: 'Nữ (HoaiMy)' },
  { id: 'vi-VN-NamMinhNeural', label: 'Nam (NamMinh)' },
];

export const TIMBRES = ['ấm', 'trong', 'trầm', 'khàn nhẹ', 'thanh thoát', 'chắc'];

// ── Phong cách hình ảnh cho chân dung AI ────────────────────
export const STYLE_PRESETS = [
  { id: 'realistic', label: 'Chân thực', prompt: 'photorealistic portrait, 85mm lens, soft studio lighting, ultra detailed skin texture, shallow depth of field' },
  { id: 'cartoon', label: 'Hoạt hình 3D', prompt: 'stylized 3D cartoon character, Pixar style, clean shapes, vibrant colors, soft global illumination' },
  { id: 'anime', label: 'Anime', prompt: 'anime character illustration, cel shading, clean line art, expressive eyes, high quality' },
  { id: 'cinematic', label: 'Điện ảnh', prompt: 'cinematic portrait, dramatic rim light, moody background, subtle film grain, anamorphic bokeh' },
];

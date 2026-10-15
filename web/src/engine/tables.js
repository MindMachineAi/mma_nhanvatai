/**
 * data.js — Kho dữ liệu để sinh nhân vật (Việt hoá + quốc tế hoá).
 * Mọi bảng đều là mảng object có `id` (khoá ổn định, dùng trong spec/JSON)
 * và `label` (tiếng Việt để hiển thị).
 */

// ── Giới tính ───────────────────────────────────────────────
export const GENDERS = [
  { id: 'nam', label: 'Nam', nameKey: 'nam', labelEn: 'male' },
  { id: 'nu', label: 'Nữ', nameKey: 'nu', labelEn: 'female' },
  { id: 'phi_nhi', label: 'Phi nhị nguyên', nameKey: 'trung_tinh', labelEn: 'androgynous' },
];

// ── Màu da ──────────────────────────────────────────────────
export const SKIN_TONES = [
  { id: 'sang', label: 'Rất sáng', hex: '#f6ddcc', shade: '#e8c3ab' },
  { id: 'trung_binh_sang', label: 'Sáng', hex: '#f0c8a8', shade: '#d9a982' },
  { id: 'trung_binh', label: 'Trung bình', hex: '#d9a273', shade: '#b9814f' },
  { id: 'ngam', label: 'Ngăm', hex: '#b5764a', shade: '#8d5730' },
  { id: 'sam', label: 'Sạm', hex: '#7d4b28', shade: '#5c3419' },
];

// ── Vóc dáng ────────────────────────────────────────────────
export const BUILDS = [
  { id: 'gay', label: 'Mảnh khảnh', mass: 0.76, width: 0.86 },
  { id: 'chuan', label: 'Cân đối', mass: 0.95, width: 1.0 },
  { id: 'the_thao', label: 'Thể thao', mass: 1.06, width: 1.1 },
  { id: 'luc_luong', label: 'Lực lưỡng', mass: 1.22, width: 1.24 },
  { id: 'day_dan', label: 'Đậm người', mass: 1.34, width: 1.18 },
];

// ── Dáng khuôn mặt ──────────────────────────────────────────
export const FACE_SHAPES = [
  { id: 'trai_xoan', label: 'Trái xoan', ratio: 1.22, jaw: 0.92 },
  { id: 'tron', label: 'Tròn', ratio: 1.05, jaw: 1.0 },
  { id: 'vuong', label: 'Vuông chữ điền', ratio: 1.2, jaw: 1.12 },
  { id: 'dai', label: 'Dài', ratio: 1.4, jaw: 0.9 },
  { id: 'tim', label: 'Trái tim', ratio: 1.16, jaw: 0.82 },
  { id: 'kim_cuong', label: 'Kim cương', ratio: 1.26, jaw: 0.88 },
];

// ── Kiểu tóc ────────────────────────────────────────────────
export const HAIR_STYLES = [
  { id: 'cai_dau', label: 'Cạo trọc', mesh: 'bald', genderBias: 'all' },
  { id: 'dau_ngan', label: 'Đầu ngắn sát', mesh: 'buzz', genderBias: 'all' },
  { id: 'ngan', label: 'Ngắn', mesh: 'short', genderBias: 'all' },
  { id: 'ngan_ru', label: 'Ngắn rẽ 7/3', mesh: 'side', genderBias: 'all' },
  { id: 'uon_xoan', label: 'Uốn xoăn', mesh: 'curly', genderBias: 'all' },
  { id: 'dai_qua_vai', label: 'Dài quá vai', mesh: 'long', genderBias: 'all' },
  { id: 'duoi_ngua', label: 'Buộc đuôi ngựa', mesh: 'ponytail', genderBias: 'all' },
  { id: 'bui_to', label: 'Búi tóc cao', mesh: 'bun', genderBias: 'all' },
  { id: 'thu_hai', label: 'Tóc hai bên', mesh: 'twintail', genderBias: 'all' },
  { id: 'toc_mohican', label: 'Tóc mohican', mesh: 'mohawk', genderBias: 'all' },
  { id: 'toc_bob', label: 'Tóc bob', mesh: 'bob', genderBias: 'all' },
  { id: 'toc_afro', label: 'Tóc afro', mesh: 'afro', genderBias: 'all' },
];

// ── Màu tóc ─────────────────────────────────────────────────
export const HAIR_COLORS = [
  { id: 'den', label: 'Đen tuyền', hex: '#1b1b1f' },
  { id: 'nau_dam', label: 'Nâu đậm', hex: '#3a2418' },
  { id: 'nau_hat_de', label: 'Nâu hạt dẻ', hex: '#6b4423' },
  { id: 'nau_sang', label: 'Nâu sáng', hex: '#9a6b3f' },
  { id: 'vang_kho', label: 'Vàng khô', hex: '#c9a227' },
  { id: 'bach_kim', label: 'Bạch kim', hex: '#e6e1d7' },
  { id: 'bac_xam', label: 'Bạc xám', hex: '#9aa0a6' },
  { id: 'muoi_tieu', label: 'Muối tiêu', hex: '#5d6066' },
  { id: 'do_dong', label: 'Đỏ đồng', hex: '#8c3b1e' },
  { id: 'tim_than', label: 'Tím than', hex: '#4a3b6b' },
  { id: 'xanh_duong', label: 'Xanh đêm', hex: '#24405e' },
  { id: 'hong_dao', label: 'Hồng đào', hex: '#d98c8c' },
];

// ── Râu ─────────────────────────────────────────────────────
export const FACIAL_HAIR = [
  { id: 'khong', label: 'Không', mesh: 'none' },
  { id: 'ria_5_phut', label: 'Râu 5 phút', mesh: 'stubble' },
  { id: 'ria_mep', label: 'Ria mép', mesh: 'mustache' },
  { id: 'rau_dai', label: 'Râu dài', mesh: 'beard' },
  { id: 'rau_de', label: 'Râu dê', mesh: 'goatee' },
];

// ── Màu mắt ─────────────────────────────────────────────────
export const EYE_COLORS = [
  { id: 'den', label: 'Đen', hex: '#241c17' },
  { id: 'nau', label: 'Nâu', hex: '#5b3a1e' },
  { id: 'nau_sang', label: 'Hổ phách', hex: '#8c5a2b' },
  { id: 'xanh_la', label: 'Xanh lá', hex: '#3f6b4a' },
  { id: 'xanh_bien', label: 'Xanh biển', hex: '#2f5f8a' },
  { id: 'xam', label: 'Xám', hex: '#6b7075' },
];

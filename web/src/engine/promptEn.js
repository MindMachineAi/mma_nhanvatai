/**
 * promptEn.js — Ánh xạ id (tiếng Việt) -> mô tả tiếng Anh.
 * Dùng để ghép prompt cho AI tạo ảnh & cho mô tả 3D.
 * Nguyên tắc: khoá là `id` trong tables.js / tables2.js, giá trị là cụm tiếng Anh.
 */
export const EN = {
  gender: {
    nam: 'male',
    nu: 'female',
    phi_nhi: 'androgynous person',
  },
  skin: {
    sang: 'very fair',
    trung_binh_sang: 'fair',
    trung_binh: 'medium tan',
    ngam: 'olive tan',
    sam: 'deep brown',
  },
  build: {
    gay: 'slim build',
    chuan: 'average build',
    the_thao: 'athletic build',
    luc_luong: 'muscular build',
    day_dan: 'heavy-set build',
  },
  face: {
    trai_xoan: 'oval face',
    tron: 'round face',
    vuong: 'square jaw face',
    dai: 'oblong face',
    tim: 'heart-shaped face',
    kim_cuong: 'diamond-shaped face',
  },
  hairStyle: {
    cai_dau: 'shaved bald head',
    dau_ngan: 'very short buzz cut',
    ngan: 'short hair',
    ngan_ru: 'short side-parted hair',
    uon_xoan: 'wavy curly hair',
    dai_qua_vai: 'shoulder-length long hair',
    duoi_ngua: 'hair tied in a ponytail',
    bui_to: 'hair in a high bun',
    thu_hai: 'twin tails',
    toc_mohican: 'mohawk hair',
    toc_bob: 'bob cut hair',
    toc_afro: 'afro hair',
  },
  hairColor: {
    den: 'jet black',
    nau_dam: 'dark brown',
    nau_hat_de: 'chestnut brown',
    nau_sang: 'light brown',
    vang_kho: 'ash blonde',
    bach_kim: 'platinum blonde',
    bac_xam: 'silver grey',
    muoi_tieu: 'salt-and-pepper',
    do_dong: 'copper red',
    tim_than: 'deep purple',
    xanh_duong: 'midnight blue',
    hong_dao: 'rose pink',
  },
  facialHair: {
    khong: 'clean shaven',
    ria_5_phut: 'light stubble',
    ria_mep: 'moustache',
    rau_dai: 'full beard',
    rau_de: 'goatee beard',
  },
  eye: {
    den: 'dark brown eyes',
    nau: 'brown eyes',
    nau_sang: 'amber eyes',
    xanh_la: 'green eyes',
    xanh_bien: 'blue eyes',
    xam: 'grey eyes',
  },
  outfit: {
    casual: 'casual streetwear',
    office: 'business casual office wear',
    formal: 'formal suit',
    sport: 'sportswear',
    uniform: 'professional uniform',
    traditional: 'traditional Vietnamese ao dai',
    techwear: 'technical techwear jacket',
    medical: 'medical scrubs and coat',
    chef: 'chef uniform',
    safety: 'high-visibility safety workwear',
    artist: 'artist apron and loose clothing',
    gamer: 'streamer hoodie',
  },
};

export const EN_ACCESSORY = {
  khong: '',
  kinh_can: 'wearing eyeglasses',
  kinh_ram: 'wearing sunglasses',
  mu_luoi_trai: 'wearing a baseball cap',
  mu_rong_vang: 'wearing a wide-brim sun hat',
  mu_bao_ho: 'wearing a hard hat',
  tai_nghe: 'wearing over-ear headphones',
  khuyen_tai: 'with a small earring',
  day_chuyen: 'with a simple necklace',
  khan_quang: 'wearing a scarf',
  ba_lo: 'carrying a backpack',
  dong_ho: 'wearing a wristwatch',
};

export const EN_OCCUPATION = {
  ky_su_bim: 'BIM engineer',
  kien_truc_su: 'architect',
  lap_trinh_vien: 'software developer',
  bac_si: 'medical doctor',
  y_ta: 'nurse',
  giao_vien: 'school teacher',
  dau_bep: 'chef',
  cong_an: 'police officer',
  linh_cuu_hoa: 'firefighter',
  phi_cong: 'airline pilot',
  huong_dan_vien: 'tour guide',
  nhan_vien_ngan_hang: 'bank officer',
  streamer: 'video game streamer',
  nhiep_anh_gia: 'photographer',
  hoa_si: 'painter',
  luat_su: 'lawyer',
  ke_toan: 'accountant',
  vo_si_mma: 'MMA fighter',
  ca_si: 'singer',
  mc: 'TV host',
  nong_dan: 'farmer',
  tai_xe_cong_nghe: 'ride-hailing driver',
  shipper: 'delivery courier',
  tho_may: 'tailor',
  nha_nghien_cuu: 'AI researcher',
  kinh_doanh: 'sales representative',
};

/** Tra nhanh: EN.<nhóm>[id] || id */
export function tr(group, id, fallback = '') {
  const bucket = EN[group];
  if (!bucket) return fallback || id;
  return bucket[id] ?? fallback ?? id;
}

/** Lấy phụ kiện tiếng Anh (bảng riêng). */
export function accessoryEn(id) {
  return EN_ACCESSORY[id] ?? '';
}

/** Lấy nghề nghiệp tiếng Anh (bảng riêng). */
export function occupationEn(id) {
  return EN_OCCUPATION[id] ?? id;
}


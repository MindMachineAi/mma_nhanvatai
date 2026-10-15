/**
 * characterEngine.js — Sinh nhân vật ảo tự động, TẤT ĐỊNH theo seed.
 *
 * Luồng: seed -> RNG -> rút thăm từ các bảng dữ liệu -> spec hoàn chỉnh
 * (danh tính, ngoại hình, trang phục, tính cách, giọng nói, chỉ số RPG,
 *  prompt ảnh AI, tham số 3D cho three.js & Blender).
 *
 * Cùng seed + cùng ràng buộc => cùng nhân vật (tái tạo 100%).
 */
import { createRng, normalizeSeed, randomSeed } from './rng.js';
import {
  GENDERS, SKIN_TONES, BUILDS, FACE_SHAPES,
  HAIR_STYLES, HAIR_COLORS, FACIAL_HAIR, EYE_COLORS,
} from './tables.js';
import {
  OUTFITS, OCCUPATIONS, ACCESSORIES, HOMETOWNS, NAME_POOL,
  ARCHETYPES, TRAITS, LIKES, DISLIKES, MOTTOS,
  TTS_VOICES, TIMBRES, STYLE_PRESETS,
} from './tables2.js';
import { tr, accessoryEn, occupationEn } from './promptEn.js';
import { colorName, darken } from './color.js';

const byId = (arr, id) => arr.find((x) => x.id === id);

/** Phụ kiện ưu tiên theo nghề nghiệp (đầu mảng = ưu tiên cao). */
const OCC_ACCESSORY = {
  ky_su_bim: ['mu_bao_ho', 'kinh_can', 'dong_ho'],
  kien_truc_su: ['kinh_can', 'dong_ho', 'khong'],
  lap_trinh_vien: ['tai_nghe', 'kinh_can', 'khong'],
  bac_si: ['kinh_can', 'dong_ho'],
  y_ta: ['dong_ho', 'kinh_can'],
  giao_vien: ['kinh_can', 'dong_ho'],
  dau_bep: ['khong', 'dong_ho'],
  cong_an: ['dong_ho', 'khong'],
  linh_cuu_hoa: ['mu_bao_ho', 'dong_ho'],
  phi_cong: ['kinh_ram', 'dong_ho'],
  huong_dan_vien: ['mu_rong_vang', 'ba_lo'],
  nhan_vien_ngan_hang: ['kinh_can', 'dong_ho'],
  streamer: ['tai_nghe', 'khong'],
  nhiep_anh_gia: ['kinh_ram', 'ba_lo'],
  hoa_si: ['khong', 'khan_quang'],
  luat_su: ['dong_ho', 'kinh_can'],
  ke_toan: ['kinh_can', 'dong_ho'],
  vo_si_mma: ['khong'],
  ca_si: ['khuyen_tai', 'day_chuyen'],
  mc: ['day_chuyen', 'dong_ho'],
  nong_dan: ['mu_rong_vang', 'khong'],
  tai_xe_cong_nghe: ['kinh_ram', 'khong'],
  shipper: ['ba_lo', 'khan_quang'],
  tho_may: ['kinh_can', 'khong'],
  nha_nghien_cuu: ['kinh_can', 'dong_ho'],
  kinh_doanh: ['dong_ho', 'day_chuyen'],
};

/** Tạo tên người (Việt hoặc quốc tế). */
function makeName(rng, nameKey) {
  const vietnamese = rng.chance(0.86);
  if (vietnamese) {
    const ho = rng.pick(NAME_POOL.ho);
    const bucket = NAME_POOL[nameKey] || NAME_POOL.trung_tinh;
    const dem = rng.pick(bucket.dem);
    const ten = rng.pick(bucket.ten);
    return { fullName: `${ho} ${dem} ${ten}`, callName: ten, origin: 'vi' };
  }
  const ho = rng.pick(NAME_POOL.quoc_te.ho);
  const pool = nameKey === 'nam' ? NAME_POOL.quoc_te.nam
    : nameKey === 'nu' ? NAME_POOL.quoc_te.nu
      : [...NAME_POOL.quoc_te.nam, ...NAME_POOL.quoc_te.nu];
  const ten = rng.pick(pool);
  return { fullName: `${ho} ${ten}`, callName: ten, origin: 'intl' };
}


/** Sinh nhân vật hoàn chỉnh. */
export function generateCharacter(input = {}) {
  const seed = normalizeSeed(input.seed ?? randomSeed());
  const rng = createRng(seed);

  // ── Ràng buộc: lọc bảng TRƯỚC khi rút thăm (số lần rút vẫn cố định) ──
  const genderPool = input.genderId
    ? GENDERS.filter((g) => g.id === input.genderId)
    : GENDERS;
  const occPool = input.occupationId
    ? OCCUPATIONS.filter((o) => o.id === input.occupationId)
    : OCCUPATIONS;

  // ── 1. Danh tính ───────────────────────────────────────
  const gender = rng.pick(genderPool.length ? genderPool : GENDERS);
  const style = byId(STYLE_PRESETS, input.style)?.id ?? rng.pick(STYLE_PRESETS).id;
  const occupation = rng.pick(occPool.length ? occPool : OCCUPATIONS);
  const name = makeName(rng, gender.nameKey);
  const ageStage = rng.pick(['trẻ', 'trưởng thành', 'trung niên', 'chín chắn']);
  const ageBase = {
    'trẻ': [18, 25],
    'trưởng thành': [26, 35],
    'trung niên': [36, 47],
    'chín chắn': [48, 62],
  }[ageStage];
  const age = rng.int(ageBase[0], ageBase[1]);
  const hometown = rng.pick(HOMETOWNS);

  // ── 2. Ngoại hình ──────────────────────────────────────
  const genderOffset = gender.id === 'nam' ? 5 : gender.id === 'nu' ? -5 : 0;
  const heightCm = Math.min(200, Math.max(148, rng.int(160, 184) + genderOffset));
  const build = rng.pick(BUILDS);
  const skinTone = rng.pick(SKIN_TONES);
  const faceShape = rng.pick(FACE_SHAPES);
  const hairStyle = rng.pick(HAIR_STYLES);
  const hairColor = rng.pick(HAIR_COLORS);
  const facialHairPool = gender.id === 'nam'
    ? FACIAL_HAIR
    : gender.id === 'nu'
      ? FACIAL_HAIR.filter((f) => ['khong', 'ria_5_phut'].includes(f.id))
      : FACIAL_HAIR.filter((f) => ['khong', 'ria_5_phut', 'rau_de'].includes(f.id));
  const facialHair = rng.pick(facialHairPool);
  const eyeColor = rng.pick(EYE_COLORS);

  // ── 3. Trang phục (gắn chặt với nghề nghiệp) ──────────
  const outfitSet = OUTFITS[occupation.outfit] ?? OUTFITS.casual;
  const palette = rng.pickMany(outfitSet.palette, 3);
  const outfit = {
    style: occupation.outfit,
    label: outfitSet.label,
    top: outfitSet.top,
    bottom: outfitSet.bottom,
    shoes: outfitSet.shoes,
    palette: {
      primary: palette[0],
      secondary: palette[1],
      accent: palette[2],
    },
  };

  // ── 4. Phụ kiện (ưu tiên theo nghề) ───────────────────
  const accPool = (OCC_ACCESSORY[occupation.id] ?? ['khong'])
    .map((id) => byId(ACCESSORIES, id))
    .filter(Boolean);
  const accessory = rng.pick(accPool.length ? accPool : ACCESSORIES);

  // ── 5. Tính cách ──────────────────────────────────────
  const archetype = rng.pick(ARCHETYPES);
  const extraTraits = rng.pickMany(TRAITS, 3);
  const traits = [...new Set([...archetype.traits, ...occupation.traits, ...extraTraits])].slice(0, 5);
  const likes = rng.pickMany(LIKES, 3);
  const dislikes = rng.pickMany(DISLIKES, 2);
  const motto = rng.pick(MOTTOS);

  // ── 6. Giọng nói (dùng cho TTS/video ở bước sau) ──────
  const voice = {
    language: 'vi-VN',
    ttsVoice: gender.id === 'nam' ? TTS_VOICES[1].id : TTS_VOICES[0].id,
    pitch: rng.range(0.85, 1.15, 2),
    speed: rng.range(0.9, 1.12, 2),
    timbre: rng.pick(TIMBRES),
  };

  // ── 7. Chỉ số RPG (tất định, có ưu thế theo nghề) ─────
  const boost = {
    vo_si_mma: { strength: 6, agility: 4 },
    nong_dan: { strength: 4, endurance: 3 },
    shipper: { agility: 5, endurance: 3 },
    lap_trinh_vien: { intellect: 6, tech: 5 },
    nha_nghien_cuu: { intellect: 7, tech: 4 },
    mc: { charm: 6, empathy: 2 },
    ca_si: { charm: 6, empathy: 3 },
    kinh_doanh: { charm: 5, empathy: 2 },
    ky_su_bim: { tech: 5, intellect: 4 },
    kien_truc_su: { intellect: 4, charm: 3 },
    bac_si: { intellect: 5, empathy: 4 },
    y_ta: { empathy: 6, endurance: 3 },
    giao_vien: { empathy: 5, intellect: 3 },
    hoa_si: { charm: 4, empathy: 4 },
  }[occupation.id] ?? {};
  const rpg = {
    level: rng.int(3, 30),
    stats: {
      strength: Math.min(20, rng.int(6, 14) + (boost.strength ?? 0)),
      agility: Math.min(20, rng.int(6, 14) + (boost.agility ?? 0)),
      endurance: Math.min(20, rng.int(6, 14) + (boost.endurance ?? 0)),
      intellect: Math.min(20, rng.int(6, 15) + (boost.intellect ?? 0)),
      empathy: Math.min(20, rng.int(6, 15) + (boost.empathy ?? 0)),
      charm: Math.min(20, rng.int(6, 15) + (boost.charm ?? 0)),
      tech: Math.min(20, rng.int(4, 14) + (boost.tech ?? 0)),
    },
  };

  const genderLabel = gender.label;
  const spec = {
    schema: 1,
    seed,
    style,
    identity: {
      fullName: name.fullName,
      callName: name.callName,
      nameOrigin: name.origin,
      gender: gender.id,
      genderLabel,
      age,
      ageStage,
      occupation: occupation.id,
      occupationLabel: occupation.label,
      hometown,
      nationality: name.origin === 'vi' ? 'Việt Nam' : 'Quốc tế',
    },
    appearance: {
      heightCm,
      build: build.id,
      skinTone: skinTone.id,
      faceShape: faceShape.id,
      hairStyle: hairStyle.id,
      hairColor: hairColor.id,
      facialHair: facialHair.id,
      eyeColor: eyeColor.id,
    },
    outfit,
    accessory: accessory.id,
    personality: {
      archetype: archetype.id,
      archetypeLabel: archetype.label,
      traits,
      likes,
      dislikes,
      motto,
    },
    voice,
    rpg,
    media: { portrait: null, glb: null },
  };

  return finalize(spec);
}


// ─────────────────────────────────────────────────────────────
//  Các hàm dẫn xuất (derived)
// ─────────────────────────────────────────────────────────────

/** Băm FNV-1a 32-bit -> chuỗi hex 8 ký tự (để tạo id ổn định). */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Bỏ dấu tiếng Việt + tạo slug an toàn cho tên file. */
export function slugify(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** id ổn định: đổi bất kỳ trường nào trong spec -> đổi id. */
export function buildId(spec) {
  const key = JSON.stringify([
    spec.seed,
    spec.style,
    spec.identity?.fullName,
    spec.identity?.gender,
    spec.identity?.occupation,
    spec.appearance,
    spec.outfit?.style,
    spec.outfit?.palette,
    spec.accessory,
  ]);
  const name = slugify(spec.identity?.fullName ?? 'nhan-vat').slice(0, 28);
  return `nv-${name}-${fnv1a(key)}`;
}

/** Bảng nhãn tiếng Việt để hiển thị/ghi file. */
export function labelLookup(spec) {
  return {
    gender: byId(GENDERS, spec.identity?.gender)?.label ?? spec.identity?.gender,
    occupation: spec.identity?.occupationLabel ?? byId(OCCUPATIONS, spec.identity?.occupation)?.label,
    build: byId(BUILDS, spec.appearance?.build)?.label ?? spec.appearance?.build,
    skinTone: byId(SKIN_TONES, spec.appearance?.skinTone)?.label ?? spec.appearance?.skinTone,
    faceShape: byId(FACE_SHAPES, spec.appearance?.faceShape)?.label ?? spec.appearance?.faceShape,
    hairStyle: byId(HAIR_STYLES, spec.appearance?.hairStyle)?.label ?? spec.appearance?.hairStyle,
    hairColor: byId(HAIR_COLORS, spec.appearance?.hairColor)?.label ?? spec.appearance?.hairColor,
    facialHair: byId(FACIAL_HAIR, spec.appearance?.facialHair)?.label ?? spec.appearance?.facialHair,
    eyeColor: byId(EYE_COLORS, spec.appearance?.eyeColor)?.label ?? spec.appearance?.eyeColor,
    accessory: byId(ACCESSORIES, spec.accessory)?.label ?? spec.accessory,
    outfit: spec.outfit?.label ?? spec.outfit?.style,
    style: byId(STYLE_PRESETS, spec.style)?.label ?? spec.style,
    archetype: spec.personality?.archetypeLabel
      ?? byId(ARCHETYPES, spec.personality?.archetype)?.label,
  };
}

/** Mô tả nhân vật bằng tiếng Việt (nhiều đoạn, tự nhiên). */
export function describeCharacter(spec) {
  const L = labelLookup(spec);
  const id = spec.identity ?? {};
  const ap = spec.appearance ?? {};
  const p = spec.personality ?? {};
  const rpg = spec.rpg ?? { stats: {} };
  const topStat = Object.entries(rpg.stats ?? {}).sort((a, b) => b[1] - a[1])[0];
  const statVi = {
    strength: 'sức mạnh', agility: 'nhanh nhẹn', endurance: 'sức bền',
    intellect: 'trí tuệ', empathy: 'đồng cảm', charm: 'cuốn hút', tech: 'kỹ thuật',
  };
  const p1 = `${id.fullName} — ${id.age} tuổi, nghề ${L.occupation}, quê ở ${id.hometown}. `
    + `Ngoại hình ${ap.heightCm}cm, vóc dáng ${L.build?.toLowerCase()}, da ${L.skinTone?.toLowerCase()}, `
    + `tóc ${L.hairStyle?.toLowerCase()} màu ${L.hairColor?.toLowerCase()}, mắt ${L.eyeColor?.toLowerCase()}`
    + `${L.facialHair && L.facialHair !== 'Không' ? `, ${L.facialHair.toLowerCase()}` : ''}. `
    + `Trang phục ${L.outfit?.toLowerCase()}${L.accessory && L.accessory !== 'Không' ? `, phụ kiện: ${L.accessory.toLowerCase()}` : ''}.`;

  const p2 = `Về tính cách, ${id.callName} thuộc nhóm "${L.archetype}" với ${(p.traits ?? []).join(', ')}. `
    + `Thích ${(p.likes ?? []).join(', ')}; không ưa ${(p.dislikes ?? []).join(', ')}. `
    + `Châm ngôn sống: "${p.motto}".`;

  const p3 = `Hồ sơ năng lực (cấp ${rpg.level ?? 1}): nổi bật nhất là ${statVi[topStat?.[0]] ?? 'kỹ năng'} `
    + `(${topStat?.[1] ?? 0}/20). Giọng nói ${spec.voice?.timbre ?? 'ấm'}, `
    + `tốc độ ${spec.voice?.speed ?? 1}x, dùng cho TTS ${spec.voice?.ttsVoice ?? ''}.`;

  return `${p1}\n\n${p2}\n\n${p3}`;
}

/** Ghép prompt tiếng Anh để AI vẽ chân dung (Gemini / Pollinations / MeToken). */
export function buildImagePrompt(spec, styleOverride) {
  const styleId = styleOverride ?? spec.style;
  const preset = byId(STYLE_PRESETS, styleId) ?? STYLE_PRESETS[0];
  const id = spec.identity ?? {};
  const ap = spec.appearance ?? {};
  const occ = byId(OCCUPATIONS, id.occupation);
  const palette = spec.outfit?.palette ?? {};
  const topName = palette.primary ? colorName(palette.primary) : 'neutral';
  const bottomName = palette.secondary ? colorName(palette.secondary) : 'dark';

  const parts = [
    `Portrait of ${id.fullName}, a ${id.age}-year-old ${tr('gender', id.gender, 'person')}`,
    `${occupationEn(id.occupation)} based in Vietnam`,
    tr('build', ap.build),
    `${tr('skin', ap.skinTone)} skin`,
    `${tr('hairStyle', ap.hairStyle)}, ${tr('hairColor', ap.hairColor)} hair`,
    tr('facialHair', ap.facialHair),
    tr('eye', ap.eyeColor),
    tr('face', ap.faceShape),
    `${tr('outfit', spec.outfit?.style)} in ${topName} and ${bottomName} tones`,
    accessoryEn(spec.accessory),
    occ?.hint,
    preset.prompt,
    'upper body framing, three-quarter turn, looking at camera, plain neutral background, sharp focus, high quality',
  ].filter(Boolean);

  return parts.join(', ');
}

/**
 * Tham số 3D dùng CHUNG cho three.js (xem trước trong web)
 * và Blender (dựng GLB có rig). Đơn vị: mét.
 */
export function build3DParams(spec) {
  const ap = spec.appearance ?? {};
  const build = byId(BUILDS, ap.build) ?? BUILDS[1];
  const face = byId(FACE_SHAPES, ap.faceShape) ?? FACE_SHAPES[0];
  const skin = byId(SKIN_TONES, ap.skinTone) ?? SKIN_TONES[2];
  const hair = byId(HAIR_COLORS, ap.hairColor) ?? HAIR_COLORS[0];
  const hairStyle = byId(HAIR_STYLES, ap.hairStyle) ?? HAIR_STYLES[2];
  const facialHair = byId(FACIAL_HAIR, ap.facialHair) ?? FACIAL_HAIR[0];
  const eye = byId(EYE_COLORS, ap.eyeColor) ?? EYE_COLORS[0];
  const acc = byId(ACCESSORIES, spec.accessory) ?? ACCESSORIES[0];
  const palette = spec.outfit?.palette ?? {};
  const bottom = palette.secondary ?? '#111827';
  const heightCm = ap.heightCm ?? 170;

  return {
    heightM: Math.round(heightCm) / 100,
    gender: spec.identity?.gender ?? 'nam',
    age: ap.age ?? spec.identity?.age ?? 30,
    ageFactor: Math.min(1, Math.max(0, ((spec.identity?.age ?? 30) - 18) / 44)),
    build: ap.build,
    mass: build.mass,
    width: build.width,
    faceRatio: face.ratio,
    jawWidth: face.jaw,
    skin: skin.hex,
    skinShade: skin.shade,
    hair: hair.hex,
    hairMesh: hairStyle.mesh,
    facialHairMesh: facialHair.mesh,
    eye: eye.hex,
    top: palette.primary ?? '#3b82f6',
    bottom,
    shoes: darken(bottom, 0.7),
    accent: palette.accent ?? '#f59e0b',
    accessoryMesh: acc.mesh,
    outfitStyle: spec.outfit?.style ?? 'casual',
  };
}

/** Bổ sung trường dẫn xuất (chạy sau khi sinh hoặc khi nhập JSON). */
export function finalize(spec) {
  const out = { ...spec };
  out.id = buildId(out);
  out.updatedAt = new Date().toISOString();
  out.labels = labelLookup(out);
  out.description = describeCharacter(out);
  out.prompt = buildImagePrompt(out);
  out.threeD = build3DParams(out);
  return out;
}

/** Gộp sâu 2 cấp (đủ cho spec nhân vật). */
function deepMerge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof base?.[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = { ...base[k], ...v };
    } else if (v !== undefined && v !== null && v !== '') {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Chỉnh tay một phần spec (từ các ô chọn trên UI) rồi tính lại mọi trường dẫn xuất.
 * Ví dụ: overrideCharacter(spec, { appearance: { hairStyle: 'bui_to' } })
 */
export function overrideCharacter(spec, overrides = {}) {
  const merged = deepMerge(spec, overrides);
  // Nếu đổi nghề mà không đổi trang phục -> đồng bộ lại bộ đồ theo nghề
  if (overrides.identity?.occupation && !overrides.outfit) {
    const occ = byId(OCCUPATIONS, overrides.identity.occupation);
    const set = OUTFITS[occ?.outfit] ?? OUTFITS.casual;
    merged.outfit = {
      style: occ?.outfit ?? 'casual',
      label: set.label,
      top: set.top,
      bottom: set.bottom,
      shoes: set.shoes,
      palette: merged.outfit?.palette ?? {
        primary: set.palette[0],
        secondary: set.palette[1],
        accent: set.palette[2],
      },
    };
    merged.identity.occupationLabel = occ?.label ?? merged.identity.occupation;
  }
  if (overrides.appearance?.heightCm !== undefined) {
    merged.appearance.heightCm = Math.min(210, Math.max(140, Number(overrides.appearance.heightCm) || 170));
  }
  return finalize(merged);
}

/** Chuẩn hoá spec nhập từ file JSON (bù các trường thiếu). */
export function normalizeSpec(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('File JSON không hợp lệ: không phải object.');
  if (!raw.identity?.fullName) throw new Error('File JSON thiếu identity.fullName — không phải character card của app này.');
  const base = generateCharacter({ seed: raw.seed ?? 'IMPORT' });
  const merged = deepMerge(base, raw);
  merged.schema = 1;
  merged.seed = String(merged.seed ?? 'IMPORT');
  merged.style = byId(STYLE_PRESETS, merged.style)?.id ?? 'realistic';
  merged.appearance.heightCm = Math.min(210, Math.max(140, Number(merged.appearance.heightCm) || 170));
  merged.appearance.build = byId(BUILDS, merged.appearance.build)?.id ?? 'chuan';
  merged.appearance.skinTone = byId(SKIN_TONES, merged.appearance.skinTone)?.id ?? 'trung_binh';
  merged.appearance.faceShape = byId(FACE_SHAPES, merged.appearance.faceShape)?.id ?? 'trai_xoan';
  merged.appearance.hairStyle = byId(HAIR_STYLES, merged.appearance.hairStyle)?.id ?? 'ngan';
  merged.appearance.hairColor = byId(HAIR_COLORS, merged.appearance.hairColor)?.id ?? 'den';
  merged.appearance.facialHair = byId(FACIAL_HAIR, merged.appearance.facialHair)?.id ?? 'khong';
  merged.appearance.eyeColor = byId(EYE_COLORS, merged.appearance.eyeColor)?.id ?? 'nau';
  merged.identity.gender = byId(GENDERS, merged.identity.gender)?.id ?? 'nam';
  merged.identity.occupation = byId(OCCUPATIONS, merged.identity.occupation)?.id ?? 'lap_trinh_vien';
  merged.identity.occupationLabel = byId(OCCUPATIONS, merged.identity.occupation)?.label;
  merged.identity.genderLabel = byId(GENDERS, merged.identity.gender)?.label;
  merged.accessory = byId(ACCESSORIES, merged.accessory)?.id ?? 'khong';
  merged.personality.traits = Array.isArray(merged.personality.traits) ? merged.personality.traits : [];
  merged.media = merged.media ?? { portrait: null, glb: null };
  return finalize(merged);
}

/** Danh mục lựa chọn cho UI (một nguồn dữ liệu duy nhất). */
export const FIELD_OPTIONS = {
  gender: GENDERS.map((g) => ({ value: g.id, label: g.label })),
  occupation: OCCUPATIONS.map((o) => ({ value: o.id, label: o.label })),
  build: BUILDS.map((b) => ({ value: b.id, label: b.label })),
  skinTone: SKIN_TONES.map((s) => ({ value: s.id, label: s.label, hex: s.hex })),
  faceShape: FACE_SHAPES.map((f) => ({ value: f.id, label: f.label })),
  hairStyle: HAIR_STYLES.map((h) => ({ value: h.id, label: h.label })),
  hairColor: HAIR_COLORS.map((h) => ({ value: h.id, label: h.label, hex: h.hex })),
  facialHair: FACIAL_HAIR.map((f) => ({ value: f.id, label: f.label })),
  eyeColor: EYE_COLORS.map((e) => ({ value: e.id, label: e.label, hex: e.hex })),
  accessory: ACCESSORIES.map((a) => ({ value: a.id, label: a.label })),
  style: STYLE_PRESETS.map((s) => ({ value: s.id, label: s.label })),
};



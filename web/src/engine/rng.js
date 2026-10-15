/**
 * rng.js — Sinh số ngẫu nhiên CÓ SEED (tất định).
 * Cùng một seed => luôn sinh ra cùng một nhân vật (tái tạo được 100%).
 * Kỹ thuật: xmur3 (hash chuỗi -> 32bit) + mulberry32 (PRNG nhanh).
 */

/** Hash chuỗi seed thành hàm sinh số 32-bit. */
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** PRNG mulberry32 — nhanh, đủ tốt cho việc sinh nhân vật. */
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tạo đối tượng RNG có seed + các hàm tiện ích. */
export function createRng(seedStr) {
  const hash = xmur3(String(seedStr));
  const next = mulberry32(hash());

  const rng = {
    /** số thực [0,1) */
    float: () => next(),
    /** số nguyên [min, max] */
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    /** phần tử ngẫu nhiên */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** true với xác suất p (0..1) */
    chance: (p) => next() < p,
    /** lấy k phần tử KHÁC NHAU */
    pickMany(arr, k) {
      const copy = [...arr];
      const out = [];
      const n = Math.min(k, copy.length);
      for (let i = 0; i < n; i++) {
        out.push(copy.splice(Math.floor(next() * copy.length), 1)[0]);
      }
      return out;
    },
    /** số thực trong [min, max) làm tròn `digits` chữ số thập phân */
    range: (min, max, digits = 0) => {
      const v = next() * (max - min) + min;
      const f = Math.pow(10, digits);
      return Math.round(v * f) / f;
    },
  };
  return rng;
}

/** Sinh seed ngẫu nhiên dạng chuỗi dễ đọc: "NV-8F3K2Q". */
export function randomSeed() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return `NV-${s}`;
}

/** Chuẩn hoá seed người dùng nhập (bỏ khoảng trắng thừa, giữ nguyên chữ/số). */
export function normalizeSeed(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return randomSeed();
  return raw.slice(0, 64);
}

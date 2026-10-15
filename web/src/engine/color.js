/**
 * color.js — Tiện ích màu dùng chung cho portrait (SVG), figure (three.js) và Blender.
 */

export function hexToRgb(hex) {
  const h = String(hex || '#000000').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

export function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Làm tối màu (factor < 1) — dùng cho giày, đổ bóng. */
export function darken(hex, factor = 0.75) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({ r: r * factor, g: g * factor, b: b * factor });
}

/** Làm sáng màu (factor > 1). */
export function lighten(hex, factor = 1.25) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({ r: r * factor + 12, g: g * factor + 12, b: b * factor + 12 });
}

/** Trộn hai màu theo tỉ lệ t (0..1). */
export function mix(a, b, t = 0.5) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex({
    r: A.r + (B.r - A.r) * t,
    g: A.g + (B.g - A.g) * t,
    b: A.b + (B.b - A.b) * t,
  });
}

/** Độ sáng tương đối (0..1) — dùng để chọn màu chữ tương phản. */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Bảng màu có tên để ghép vào prompt AI ("cobalt blue" thay vì "#1e3a8a"). */
const NAMED_COLORS = [
  ['#000000', 'black'], ['#111827', 'charcoal'], ['#374151', 'slate grey'],
  ['#6b7280', 'grey'], ['#9ca3af', 'light grey'], ['#e5e7eb', 'off white'],
  ['#f5f5f5', 'white'], ['#ffffff', 'white'], ['#b91c1c', 'crimson red'],
  ['#ef4444', 'bright red'], ['#f97316', 'orange'], ['#facc15', 'yellow'],
  ['#a16207', 'mustard brown'], ['#65a30d', 'olive green'], ['#16a34a', 'green'],
  ['#065f46', 'deep green'], ['#0f766e', 'teal'], ['#0ea5e9', 'sky blue'],
  ['#0369a1', 'deep blue'], ['#1d4ed8', 'royal blue'], ['#1e3a8a', 'navy blue'],
  ['#24405e', 'midnight blue'], ['#7c3aed', 'violet'], ['#7e22ce', 'purple'],
  ['#db2777', 'magenta pink'], ['#d98c8c', 'dusty rose'], ['#422006', 'dark brown'],
  ['#7c2d12', 'rust brown'], ['#c2410c', 'burnt orange'], ['#8c3b1e', 'copper'],
  ['#e0f2fe', 'pale blue'], ['#f8fafc', 'white'], ['#4b5563', 'graphite'],
  ['#0b3d2e', 'forest green'], ['#3f2a56', 'aubergine'],
];

/** Tên màu gần nhất (tiếng Anh) cho prompt AI. */
export function colorName(hex) {
  const target = hexToRgb(hex);
  let best = NAMED_COLORS[0];
  let bestDist = Infinity;
  for (const [h, name] of NAMED_COLORS) {
    const c = hexToRgb(h);
    const d = (c.r - target.r) ** 2 + (c.g - target.g) ** 2 + (c.b - target.b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = [h, name];
    }
  }
  return best[1];
}

/**
 * portrait.js — Sinh chân dung 2D dạng SVG ngay trong trình duyệt.
 *
 * Mục đích:
 *  - Có ảnh đại diện TỨC THỜI, tất định theo spec, chạy offline (không cần API, không tốn tiền).
 *  - Dùng làm thumbnail trong thư viện; ảnh AI chỉ là lớp "nâng cấp" khi người dùng bấm nút.
 */
import { darken, lighten, mix } from './engine/color.js';

/** Bảng "mood" theo phong cách ảnh (khớp id trong STYLE_PRESETS). */
export const STYLE_LOOK = {
  realistic: { bg1: '#eef2f7', bg2: '#c3ccd9', halo: '#ffffff', line: null, lw: 0, cheek: 0.1, rim: 0.15 },
  cartoon: { bg1: '#fef3c7', bg2: '#bfdbfe', halo: '#ffffff', line: '#111827', lw: 5, cheek: 0.3, rim: 0 },
  anime: { bg1: '#dbeafe', bg2: '#fbcfe8', halo: '#ffffff', line: '#1f2937', lw: 3, cheek: 0.35, rim: 0.5 },
  cinematic: { bg1: '#0b1220', bg2: '#1e293b', halo: '#334155', line: null, lw: 0, cheek: 0.06, rim: 0.85 },
};

const b = (v) => Math.round(v * 100) / 100;

/** Đầu: trả về kích thước & tâm hộp sọ theo tham số 3D. */
function headBox(p) {
  const sy = Math.min(1.16, Math.max(0.86, 0.88 + ((p.faceRatio ?? 1.2) - 1.05) * 0.4));
  const jaw = 0.92 + (p.jawWidth ?? 0.95) * 0.1;
  const cy = 178;
  return { cx: 160, cy, rx: b(62 * jaw), ry: b(76 * sy), jaw, sy };
}

/** Tóc lớp SAU (nằm dưới đầu): dài, bob, afro, đuôi ngựa, hai bên. */
function hairBack(mesh, h, color) {
  const { cx, cy, rx, ry } = h;
  const dark = darken(color, 0.72);
  switch (mesh) {
    case 'long':
      return `<path d="M ${cx - rx * 1.35} ${cy - ry * 0.1} q 0 ${ry * 1.9} ${rx * 0.3} ${ry * 2.05} l ${rx * 2.1} 0 q ${rx * 0.3} -${ry * 0.15} ${rx * 0.3} -${ry * 2.05} z" fill="${color}"/>`;
    case 'bob':
      return `<ellipse cx="${cx}" cy="${cy + ry * 0.18}" rx="${rx * 1.3}" ry="${ry * 1.28}" fill="${color}"/>`;
    case 'afro':
      return `<circle cx="${cx}" cy="${cy - ry * 0.16}" r="${rx * 1.5}" fill="${color}"/>`;
    case 'ponytail':
      return `<ellipse cx="${cx + rx * 0.9}" cy="${cy + ry * 0.5}" rx="${rx * 0.42}" ry="${ry * 1.05}" fill="${color}" transform="rotate(-12 ${cx} ${cy})"/>`;
    case 'twintail':
      return `<ellipse cx="${cx - rx * 1.15}" cy="${cy + ry * 0.35}" rx="${rx * 0.34}" ry="${ry * 0.95}" fill="${color}"/>`
        + `<ellipse cx="${cx + rx * 1.15}" cy="${cy + ry * 0.35}" rx="${rx * 0.34}" ry="${ry * 0.95}" fill="${color}"/>`;
    case 'curly':
    case 'short':
      return `<ellipse cx="${cx}" cy="${cy - ry * 0.1}" rx="${rx * 1.09}" ry="${ry * 1.02}" fill="${color}"/>`;
    case 'afro-hint':
      return `<ellipse cx="${cx}" cy="${cy - ry * 0.1}" rx="${rx * 1.12}" ry="${ry * 1.05}" fill="${dark}"/>`;
    default:
      return `<ellipse cx="${cx}" cy="${cy - ry * 0.14}" rx="${rx * 1.05}" ry="${ry * 0.99}" fill="${color}"/>`;
  }
}

/** Tóc lớp TRƯỚC (phủ lên trán). */
function hairFront(mesh, h, color) {
  const { cx, cy, rx, ry } = h;
  const top = `M ${cx - rx * 1.03} ${cy - ry * 0.16} A ${rx * 1.03} ${ry * 0.98} 0 0 1 ${cx + rx * 1.03} ${cy - ry * 0.16} Z`;
  const fringe = `M ${cx - rx * 1.0} ${cy - ry * 0.2} q ${rx * 0.5} ${ry * 0.42} ${rx * 1.0} ${ry * 0.02} q ${rx * 0.5} -${ry * 0.4} ${rx * 1.0} -${ry * 0.02} l 0 -${ry * 0.2} l -${rx * 2} 0 z`;

  switch (mesh) {
    case 'bald':
      return '';
    case 'buzz':
      return `<path d="${top}" fill="${color}" opacity="0.92"/>`;
    case 'short':
      return `<path d="${top}" fill="${color}"/>`;
    case 'side':
      return `<path d="${fringe}" fill="${color}"/><path d="M ${cx - rx * 0.95} ${cy - ry * 0.25} q ${rx * 0.35} ${ry * 0.5} ${rx * 0.85} ${ry * 0.1} l -${rx * 0.15} -${ry * 0.32} z" fill="${color}"/>`;
    case 'curly':
      return `<path d="${top}" fill="${color}"/>` + [0, 1, 2, 3, 4, 5].map((i) => {
        const a = Math.PI * (0.1 + i * 0.16);
        return `<circle cx="${b(cx - Math.cos(a) * rx * 0.9)}" cy="${b(cy - Math.sin(a) * ry * 0.82)}" r="${b(rx * 0.2)}" fill="${color}"/>`;
      }).join('');
    case 'long':
      return `<path d="${fringe}" fill="${color}"/>`;
    case 'ponytail':
      return `<path d="${top}" fill="${color}"/>`;
    case 'bun':
      return `<path d="${top}" fill="${color}"/><circle cx="${cx}" cy="${b(cy - ry * 1.08)}" r="${b(rx * 0.34)}" fill="${color}"/>`;
    case 'twintail':
      return `<path d="${fringe}" fill="${color}"/>`;
    case 'mohawk':
      return `<path d="${top}" fill="${color}" opacity="0.55"/><rect x="${b(cx - rx * 0.16)}" y="${b(cy - ry * 1.5)}" width="${b(rx * 0.32)}" height="${b(ry * 0.9)}" rx="${b(rx * 0.1)}" fill="${color}"/>`;
    case 'bob':
      return `<path d="M ${cx - rx * 1.08} ${cy - ry * 0.3} q ${rx * 1.08} -${ry * 0.75} ${rx * 2.16} 0 q -${rx * 0.7} ${ry * 0.28} -${rx * 1.08} ${ry * 0.1} q -${rx * 0.38} ${ry * 0.2} -${rx * 1.08} -${ry * 0.1} z" fill="${color}"/>`;
    case 'afro':
    default:
      return `<path d="${top}" fill="${color}"/>`;
  }
}

/** Phụ kiện vẽ trên đầu/mặt. */
function accHead(id, h, c, look) {
  const { cx, cy, rx, ry } = h;
  const outline = look.line ? ` stroke="${look.line}" stroke-width="${look.lw / 2}"` : '';
  switch (id) {
    case 'glasses':
      return `<g fill="none" stroke="#1f2937" stroke-width="3.5">
        <rect x="${b(cx - rx * 0.78)}" y="${b(cy - ry * 0.16)}" width="${b(rx * 0.66)}" height="${b(ry * 0.42)}" rx="${b(rx * 0.16)}"/>
        <rect x="${b(cx + rx * 0.12)}" y="${b(cy - ry * 0.16)}" width="${b(rx * 0.66)}" height="${b(ry * 0.42)}" rx="${b(rx * 0.16)}"/>
        <line x1="${b(cx - rx * 0.12)}" y1="${b(cy + 0.05 * ry)}" x2="${b(cx + rx * 0.12)}" y2="${b(cy + 0.05 * ry)}"/>
        <line x1="${b(cx - rx * 0.78)}" y1="${b(cy)}" x2="${b(cx - rx * 1.02)}" y2="${b(cy - ry * 0.08)}"/>
        <line x1="${b(cx + rx * 0.78)}" y1="${b(cy)}" x2="${b(cx + rx * 1.02)}" y2="${b(cy - ry * 0.08)}"/>
      </g>`;
    case 'sunglasses':
      return `<g fill="#0b1220">
        <rect x="${b(cx - rx * 0.8)}" y="${b(cy - ry * 0.2)}" width="${b(rx * 0.72)}" height="${b(ry * 0.46)}" rx="${b(rx * 0.18)}"/>
        <rect x="${b(cx + rx * 0.08)}" y="${b(cy - ry * 0.2)}" width="${b(rx * 0.72)}" height="${b(ry * 0.46)}" rx="${b(rx * 0.18)}"/>
        <rect x="${b(cx - rx * 0.1)}" y="${b(cy - ry * 0.06)}" width="${b(rx * 0.2)}" height="${b(ry * 0.1)}"/>
      </g>`;
    case 'cap':
      return `<g><path d="M ${b(cx - rx * 1.06)} ${b(cy - ry * 0.32)} a ${b(rx * 1.06)} ${b(ry * 0.86)} 0 0 1 ${b(rx * 2.12)} 0 z" fill="${c.accent}"/>
        <ellipse cx="${b(cx)}" cy="${b(cy - ry * 0.2)}" rx="${b(rx * 1.05)}" ry="${b(ry * 0.3)}" fill="${c.accent}"/>
        <path d="M ${b(cx - rx * 1.5)} ${b(cy - ry * 0.3)} q ${b(rx * 1.5)} ${b(ry * 0.22)} ${b(rx * 3)} 0 q -${b(rx * 1.5)} ${b(ry * 0.3)} -${b(rx * 3)} 0 z" fill="${darken(c.accent, 0.82)}"/></g>`;
    case 'sunhat':
      return `<g><ellipse cx="${b(cx)}" cy="${b(cy - ry * 0.18)}" rx="${b(rx * 2.2)}" ry="${b(ry * 0.36)}" fill="#e6d3a3"/>
        <path d="M ${b(cx - rx * 1.1)} ${b(cy - ry * 0.24)} a ${b(rx * 1.1)} ${b(ry * 0.8)} 0 0 1 ${b(rx * 2.2)} 0 z" fill="#efe0b8"/>
        <rect x="${b(cx - rx * 1.12)}" y="${b(cy - ry * 0.34)}" width="${b(rx * 2.24)}" height="${b(ry * 0.14)}" fill="${c.accent}"/></g>`;
    case 'hardhat':
      return `<g><path d="M ${b(cx - rx * 1.14)} ${b(cy - ry * 0.3)} a ${b(rx * 1.14)} ${b(ry * 0.9)} 0 0 1 ${b(rx * 2.28)} 0 z" fill="${c.accent}"/>
        <rect x="${b(cx - rx * 1.4)}" y="${b(cy - ry * 0.32)}" width="${b(rx * 2.8)}" height="${b(ry * 0.12)}" rx="${b(ry * 0.06)}" fill="${darken(c.accent, 0.85)}"/>
        <rect x="${b(cx - rx * 0.1)}" y="${b(cy - ry * 1.06)}" width="${b(rx * 0.2)}" height="${b(ry * 0.77)}" rx="${b(rx * 0.08)}" fill="${lighten(c.accent, 1.1)}"/></g>`;
    case 'headset':
      return `<g fill="#111827"><path d="M ${b(cx - rx * 1.2)} ${b(cy)} a ${b(rx * 1.2)} ${b(ry * 1.05)} 0 0 1 ${b(rx * 2.4)} 0" fill="none" stroke="#111827" stroke-width="9"/>
        <rect x="${b(cx - rx * 1.42)}" y="${b(cy - ry * 0.02)}" width="${b(rx * 0.3)}" height="${b(ry * 0.5)}" rx="${b(rx * 0.12)}"/>
        <rect x="${b(cx + rx * 1.12)}" y="${b(cy - ry * 0.02)}" width="${b(rx * 0.3)}" height="${b(ry * 0.5)}" rx="${b(rx * 0.12)}"/>
        <rect x="${b(cx + rx * 0.72)}" y="${b(cy + ry * 0.16)}" width="${b(rx * 0.5)}" height="${b(ry * 0.1)}" rx="${b(ry * 0.05)}"/></g>`;
    case 'earring':
      return `<g fill="${c.accent}" stroke="${outline ? look.line : 'none'}" stroke-width="${look.line ? 1.5 : 0}">
        <circle cx="${b(cx - rx * 1.01)}" cy="${b(cy + ry * 0.34)}" r="${b(rx * 0.09)}"/>
        <circle cx="${b(cx + rx * 1.01)}" cy="${b(cy + ry * 0.34)}" r="${b(rx * 0.09)}"/></g>`;
    default:
      return '';
  }
}

/** Râu 2D. */
function facialHair2D(mesh, h, hair) {
  const { cx, cy, rx, ry } = h;
  const dark = darken(hair, 0.6);
  const mustache = `<path d="M ${b(cx - rx * 0.34)} ${b(cy + ry * 0.34)} q ${b(rx * 0.34)} ${b(ry * 0.22)} ${b(rx * 0.68)} 0 q -${b(rx * 0.34)} ${b(ry * 0.12)} -${b(rx * 0.68)} 0 z" fill="${dark}"/>`;
  switch (mesh) {
    case 'stubble':
      return `<path d="M ${b(cx - rx * 0.99)} ${b(cy + ry * 0.02)} a ${b(rx * 0.99)} ${b(ry * 0.99)} 0 0 0 ${b(rx * 1.98)} 0 z" fill="${dark}" opacity="0.28"/>`;
    case 'mustache':
      return mustache;
    case 'goatee':
      return mustache + `<ellipse cx="${b(cx)}" cy="${b(cy + ry * 0.78)}" rx="${b(rx * 0.24)}" ry="${b(ry * 0.2)}" fill="${dark}"/>`;
    case 'beard':
      return `<path d="M ${b(cx - rx)} ${b(cy + ry * 0.06)} a ${b(rx)} ${b(ry)} 0 0 0 ${b(rx * 2)} 0 q -${b(rx * 0.45)} ${b(ry * 0.72)} -${b(rx * 2)} 0 z" fill="${dark}"/>` + mustache;
    default:
      return '';
  }
}

export function buildPortraitSvg(ch, { size = 320, caption = '' } = {}) {
  const p = ch?.threeD ?? {};
  const look = STYLE_LOOK[ch?.style] ?? STYLE_LOOK.realistic;
  const h = headBox(p);
  const { cx, cy, rx, ry } = h;
  const sh = Math.min(132, 100 * (p.width ?? 1) + 14);
  const shoulderY = cy + ry * 1.86;
  const skin = p.skin ?? '#f0c8a8';
  const skinShade = p.skinShade ?? darken(skin, 0.9);
  const hair = p.hair ?? '#1b1b1f';
  const eye = p.eye ?? '#241c17';
  const c = { accent: p.accent ?? '#f59e0b', top: p.top ?? '#3b82f6', bottom: p.bottom ?? '#111827' };
  const W = 320;
  const H = 420;

  const s = [];
  s.push(`<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="${look.bg1}"/><stop offset="1" stop-color="${look.bg2}"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.42" r="0.55">
      <stop offset="0" stop-color="${look.halo}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${look.halo}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="shirt" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${lighten(c.top, 1.08)}"/><stop offset="1" stop-color="${c.top}"/>
    </linearGradient>
  </defs>`);

  s.push(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);
  s.push(`<ellipse cx="${cx}" cy="${cy - 10}" rx="150" ry="180" fill="url(#halo)"/>`);

  // Tóc lớp sau + thân + cổ
  s.push(hairBack(p.hairMesh, h, hair));
  s.push(`<path d="M ${cx - sh} ${H} C ${cx - sh} ${b(shoulderY + 22)} ${b(cx - sh * 0.6)} ${b(shoulderY - 16)} ${cx} ${b(shoulderY - 16)} C ${b(cx + sh * 0.6)} ${b(shoulderY - 16)} ${cx + sh} ${b(shoulderY + 22)} ${cx + sh} ${H} Z" fill="url(#shirt)"${look.line ? ` stroke="${look.line}" stroke-width="${look.lw}"` : ''}/>`);
  s.push(`<path d="M ${b(cx - 30)} ${b(shoulderY - 14)} L ${cx} ${b(shoulderY + 26)} L ${b(cx + 30)} ${b(shoulderY - 14)} q -30 16 -60 0 z" fill="${mix(c.top, '#ffffff', 0.72)}"/>`);
  s.push(`<path d="M ${b(cx - sh * 0.72)} ${H} C ${b(cx - sh * 0.74)} ${b(shoulderY + 70)} ${b(cx - sh * 0.56)} ${b(shoulderY + 20)} ${b(cx - sh * 0.44)} ${b(shoulderY + 2)} l ${b(sh * 0.14)} ${b(sh * 0.06)} C ${b(cx - sh * 0.58)} ${b(shoulderY + 40)} ${b(cx - sh * 0.6)} ${b(H)} ${b(cx - sh * 0.62)} ${H} Z" fill="${c.bottom}" opacity="0.92"/>`);
  s.push(`<path d="M ${b(cx - 24)} ${b(cy + ry * 0.58)} l 48 0 l 0 ${b(shoulderY - cy - ry * 0.58 + 6)} l -48 0 z" fill="${skinShade}"/>`);

  // Đầu + tai
  s.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${skin}"${look.line ? ` stroke="${look.line}" stroke-width="${look.lw}"` : ''}/>
    <ellipse cx="${b(cx - rx * 0.99)}" cy="${b(cy + ry * 0.06)}" rx="${b(rx * 0.13)}" ry="${b(ry * 0.16)}" fill="${skinShade}"/>
    <ellipse cx="${b(cx + rx * 0.99)}" cy="${b(cy + ry * 0.06)}" rx="${b(rx * 0.13)}" ry="${b(ry * 0.16)}" fill="${skinShade}"/>
    <path d="M ${b(cx - rx * 0.55)} ${b(cy + ry * 0.56)} q ${b(rx * 0.55)} ${b(ry * 0.4)} ${b(rx * 1.1)} 0" fill="none" stroke="${skinShade}" stroke-width="7" opacity="0.65"/>`);
  s.push(facialHair2D(p.facialHairMesh, h, hair));

  // Mắt, lông mày, mũi, miệng, má
  for (const side of [-1, 1]) {
    const ex = b(cx + side * rx * 0.38);
    const ey = b(cy - ry * 0.02);
    s.push(`<ellipse cx="${ex}" cy="${ey}" rx="${b(rx * 0.19)}" ry="${b(ry * 0.13)}" fill="#ffffff"/>
      <circle cx="${ex}" cy="${ey}" r="${b(rx * 0.088)}" fill="${eye}"/>
      <circle cx="${ex}" cy="${ey}" r="${b(rx * 0.042)}" fill="${darken(eye, 0.55)}"/>
      <circle cx="${b(ex + rx * 0.035)}" cy="${b(ey - ry * 0.03)}" r="${b(rx * 0.026)}" fill="#ffffff" opacity="0.95"/>
      <path d="M ${b(ex - rx * 0.2)} ${b(ey - ry * 0.3)} q ${b(rx * 0.2)} -${b(ry * 0.12)} ${b(rx * 0.4)} ${b(ry * 0.02)}" fill="none" stroke="${darken(hair, 0.8)}" stroke-width="${look.lw ? 6 : 5}" stroke-linecap="round"/>`);
    if (look.cheek > 0.12) {
      s.push(`<ellipse cx="${b(cx + side * rx * 0.62)}" cy="${b(cy + ry * 0.3)}" rx="${b(rx * 0.2)}" ry="${b(ry * 0.1)}" fill="#f08a8a" opacity="${look.cheek}"/>`);
    }
  }
  s.push(`<path d="M ${b(cx + rx * 0.06)} ${b(cy - ry * 0.02)} q ${b(rx * 0.12)} ${b(ry * 0.2)} -${b(rx * 0.08)} ${b(ry * 0.28)}" fill="none" stroke="${skinShade}" stroke-width="4" stroke-linecap="round"/>`);
  s.push(`<path d="M ${b(cx - rx * 0.22)} ${b(cy + ry * 0.44)} q ${b(rx * 0.22)} ${b(ry * 0.2)} ${b(rx * 0.44)} 0" fill="none" stroke="#a35b5b" stroke-width="${look.lw ? 5 : 4}" stroke-linecap="round"/>`);

  s.push(hairFront(p.hairMesh, h, hair));

  s.push(accHead(p.accessoryMesh, h, c, look));
  s.push(accBody(p.accessoryMesh, h, { sh }, c, look));

  // Ánh viền theo phong cách
  if (look.rim > 0.1) {
    s.push(`<path d="M ${b(cx + rx * 0.86)} ${b(cy - ry * 0.72)} a ${b(rx)} ${b(ry)} 0 0 1 ${b(rx * 0.06)} ${b(ry * 1.5)}" fill="none" stroke="#cfe3ff" stroke-width="7" stroke-linecap="round" opacity="${look.rim}"/>`);
  }

  if (caption) {
    s.push(`<rect x="0" y="${H - 52}" width="${W}" height="52" fill="rgba(0,0,0,0.45)"/>
      <text x="16" y="${H - 19}" font-family="Segoe UI, Roboto, sans-serif" font-size="20" font-weight="600" fill="#ffffff">${escapeXml(caption)}</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${size}" height="${Math.round((size * H) / W)}" role="img">${s.join('\n')}</svg>`;
}

export const PORTRAIT_RATIO = 420 / 320;

function escapeXml(str) {
  const map = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' };
  return String(str).replace(/[<>&"']/g, (ch) => map[ch]);
}

/** Ảnh SVG dạng data URL -> gán thẳng vào <img src>. */
export function portraitDataUrl(ch, opts) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildPortraitSvg(ch, opts))}`;
}

/** Chuyển SVG sang PNG (Blob) để tải về hoặc gửi lên server. */
export function portraitPng(ch, { size = 512, caption = '' } = {}) {
  const svg = buildPortraitSvg(ch, { size, caption });
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = Math.round(size * PORTRAIT_RATIO);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không tạo được PNG'))), 'image/png');
    };
    img.onerror = () => reject(new Error('Không đọc được SVG'));
    img.src = url;
  });
}

/** Phụ kiện vẽ trên thân. */
function accBody(id, h, g, c, look) {
  const { cx, cy, ry } = h;
  const shoulderY = cy + ry * 1.9;
  switch (id) {
    case 'necklace':
      return `<path d="M ${b(cx - 26)} ${b(shoulderY - 10)} q 26 26 52 0" fill="none" stroke="${c.accent}" stroke-width="5" stroke-linecap="round"/>`;
    case 'scarf':
      return `<rect x="${b(cx - 40)}" y="${b(shoulderY - 22)}" width="80" height="28" rx="12" fill="${c.accent}"/>
        <rect x="${b(cx + 12)}" y="${b(shoulderY - 4)}" width="18" height="56" rx="8" fill="${mix(c.accent, '#000000', 0.15)}"/>`;
    case 'backpack':
      return `<g fill="${darken(c.accent, 0.85)}" opacity="0.95">
        <rect x="${b(cx - g.sh * 0.72)}" y="${b(shoulderY - 6)}" width="20" height="90" rx="9" transform="rotate(9 ${b(cx - g.sh * 0.62)} ${b(shoulderY)})"/>
        <rect x="${b(cx + g.sh * 0.72 - 20)}" y="${b(shoulderY - 6)}" width="20" height="90" rx="9" transform="rotate(-9 ${b(cx + g.sh * 0.62)} ${b(shoulderY)})"/></g>`;
    default:
      return '';
  }
}


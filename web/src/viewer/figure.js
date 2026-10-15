/**
 * figure.js — Dựng nhân vật 3D từ tham số `threeD` của Character Engine.
 *
 * Nguyên tắc:
 *  - Chỉ dùng hình khối nguyên thuỷ của three.js => chạy offline, không cần tải model.
 *  - Có phân nhóm (hips/torso/head/arms/legs) để gắn animation idle.
 *  - Cùng bộ tham số `threeD` này Blender cũng dùng (xem api/blender_pipeline).
 */
import * as THREE from 'three';
import { darken, lighten } from '../engine/color.js';

// ── Vật liệu ────────────────────────────────────────────────
export function mat(color, { rough = 0.75, metal = 0.05, opacity = 1 } = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: rough,
    metalness: metal,
    transparent: opacity < 1,
    opacity,
  });
}

const skinMat = (c) => mat(c, { rough: 0.72 });
const clothMat = (c) => mat(c, { rough: 0.9 });
const hairMat = (c) => mat(c, { rough: 0.55 });
const rubberMat = (c) => mat(c, { rough: 0.95 });

// ── Hình khối nguyên thuỷ ───────────────────────────────────
const capsule = (r, len, seg = 12) => new THREE.CapsuleGeometry(r, len, 6, seg);
const sphere = (r, w = 24, h = 18) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const torus = (r, tube, seg = 10, tub = 24) => new THREE.TorusGeometry(r, tube, seg, tub);
/** Chỏm cầu (dùng cho tóc/mũ): thetaLength < PI => chỉ lấy phần trên. */
const cap = (r, theta = Math.PI * 0.55, phi = Math.PI * 2, phiStart = 0) =>
  new THREE.SphereGeometry(r, 24, 16, phiStart, phi, 0, theta);

/** Gắn mesh vào cha, đặt vị trí/xoay nhanh. */
function put(parent, geo, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], name = '') {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  parent.add(m);
  return m;
}

// ── Nhân trắc học cơ bản (tỉ lệ người thật ~7.5 đầu) ────────
export function proportions(p) {
  const H = p.heightM;
  const mass = p.mass ?? 1;
  const width = p.width ?? 1;
  const genderNarrow = p.gender === 'nu' ? 0.9 : p.gender === 'phi_nhi' ? 0.95 : 1;
  const h = H / 7.4; // chiều cao 1 đầu

  return {
    H,
    h,
    headR: h * 0.5,
    neckH: h * 0.28,
    legH: H * 0.47,
    thighR: h * 0.20 * mass,
    shinR: h * 0.16 * mass,
    hipW: h * 0.36 * width * (p.gender === 'nu' ? 1.06 : 1),
    torsoH: H * 0.30,
    torsoW: h * 0.52 * mass * genderNarrow,
    torsoD: h * 0.34 * mass,
    shoulderW: h * 0.62 * width * genderNarrow,
    upperArmR: h * 0.115 * mass,
    foreArmR: h * 0.10 * mass,
    upperArmL: H * 0.16,
    foreArmL: H * 0.155,
    footL: h * 0.55,
  };
}


/**
 * Tóc — mỗi `mesh` id trong HAIR_STYLES ứng với một cách dựng khối.
 * `parent` là group cái đầu (gốc tại tâm hộp sọ, mặt hướng +Z).
 */
export function buildHair(parent, id, R, sy, color) {
  const m = hairMat(color);
  const g = new THREE.Group();
  g.name = 'hair';
  parent.add(g);
  const r = R * 1.03;
  const S = [1, sy, 1.02];

  switch (id) {
    case 'bald':
      return g;
    case 'buzz':
      put(g, cap(r, Math.PI * 0.5), m, [0, 0, 0], [0, 0, 0], S);
      break;
    case 'short':
      put(g, cap(r, Math.PI * 0.58), m, [0, 0, 0], [0, 0, 0], S);
      put(g, sphere(r * 0.5), m, [0, -r * 0.12, -r * 0.62], [0, 0, 0], [1.6, 0.9, 0.7]);
      break;
    case 'side':
      put(g, cap(r, Math.PI * 0.58), m, [0, 0, 0], [0, 0, 0], S);
      put(g, box(r * 0.9, r * 0.5, r * 0.35), m, [-r * 0.45, r * 0.62, r * 0.55], [0.25, 0.2, 0.35]);
      break;
    case 'curly':
      put(g, cap(r * 1.04, Math.PI * 0.66), m, [0, 0, 0], [0, 0, 0], S);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        put(g, sphere(r * 0.3), m, [Math.cos(a) * r * 0.82, r * 0.55 - (i % 2) * r * 0.22, Math.sin(a) * r * 0.82]);
      }
      break;
    case 'long':
      put(g, cap(r, Math.PI * 0.6), m, [0, 0, 0], [0, 0, 0], S);
      put(g, box(r * 1.75, r * 2.4, r * 0.55), m, [0, -r * 1.0, -r * 0.52]);
      put(g, box(r * 0.42, r * 1.9, r * 1.1), m, [r * 0.95, -r * 0.75, -r * 0.1]);
      put(g, box(r * 0.42, r * 1.9, r * 1.1), m, [-r * 0.95, -r * 0.75, -r * 0.1]);
      break;
    case 'ponytail':
      put(g, cap(r, Math.PI * 0.58), m, [0, 0, 0], [0, 0, 0], S);
      put(g, capsule(r * 0.28, r * 1.5), m, [0, -r * 0.55, -r * 0.95], [0.45, 0, 0]);
      break;
    case 'bun':
      put(g, cap(r, Math.PI * 0.58), m, [0, 0, 0], [0, 0, 0], S);
      put(g, sphere(r * 0.45), m, [0, r * 0.75, -r * 0.75], [0, 0, 0], [1, 0.9, 1]);
      break;
    case 'twintail':
      put(g, cap(r, Math.PI * 0.6), m, [0, 0, 0], [0, 0, 0], S);
      put(g, capsule(r * 0.24, r * 1.5), m, [r * 1.05, -r * 0.35, -r * 0.15], [0, 0, 0.32]);
      put(g, capsule(r * 0.24, r * 1.5), m, [-r * 1.05, -r * 0.35, -r * 0.15], [0, 0, -0.32]);
      break;
    case 'mohawk':
      put(g, cap(r, Math.PI * 0.45), m, [0, 0, 0], [0, 0, 0], [0.55, 1.02, 1.02]);
      put(g, box(r * 0.28, r * 0.85, r * 1.5), m, [0, r * 0.92, -r * 0.05]);
      break;
    case 'bob':
      put(g, cap(r * 1.05, Math.PI * 0.62), m, [0, 0, 0], [0, 0, 0], S);
      put(g, cyl(r * 1.12, r * 1.12, r * 0.85, 20), m, [0, -r * 0.42, 0], [0, 0, 0], [1, 1, 1.02]);
      break;
    case 'afro':
      put(g, sphere(r * 1.35), m, [0, r * 0.18, 0], [0, 0, 0], [1, 0.95, 1]);
      break;
    default:
      put(g, cap(r, Math.PI * 0.56), m, [0, 0, 0], [0, 0, 0], S);
  }
  return g;
}

/** Râu — `mesh` id trong FACIAL_HAIR. */
export function buildFacialHair(parent, id, R, color) {
  const g = new THREE.Group();
  g.name = 'facial-hair';
  parent.add(g);
  const dark = new THREE.Color(color).multiplyScalar(0.55).getStyle();
  const soft = mat(dark, { rough: 0.9, opacity: 0.45 });
  const solid = hairMat(dark);

  switch (id) {
    case 'stubble':
      put(g, new THREE.SphereGeometry(R * 1.004, 24, 16, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.24), soft);
      break;
    case 'mustache':
      put(g, new THREE.SphereGeometry(R * 1.004, 24, 16, 0, Math.PI * 2, Math.PI * 0.46, Math.PI * 0.08), solid,
        [0, 0, 0], [0, 0, 0], [0.85, 1, 1.02]);
      break;
    case 'goatee':
      put(g, new THREE.SphereGeometry(R * 1.006, 24, 16, 0, Math.PI * 2, Math.PI * 0.46, Math.PI * 0.08), solid,
        [0, 0, 0], [0, 0, 0], [0.8, 1, 1.02]);
      put(g, box(R * 0.5, R * 0.75, R * 0.35), solid, [0, -R * 0.92, R * 0.52], [0.15, 0, 0]);
      break;
    case 'beard':
      put(g, new THREE.SphereGeometry(R * 1.01, 24, 16, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), solid,
        [0, 0, 0], [0, 0, 0], [1, 1.1, 1.03]);
      put(g, box(R * 0.72, R * 0.95, R * 0.42), solid, [0, -R * 0.98, R * 0.42], [0.12, 0, 0]);
      break;
    case 'none':
    default:
      break;
  }
  return g;
}


/** Nhích nhẹ chỏm mũ lên cho khỏi lún vào tóc. */
function r0(R) {
  return R * 0.06;
}

/**
 * Phụ kiện gắn vào đầu/mặt: glasses, sunglasses, cap, sunhat, hardhat,
 * headset, earring. `R` = bán kính sọ, `sy` = hệ số co giãn dọc của đầu.
 */
export function buildHeadAccessory(parent, id, R, sy, accent = '#f59e0b') {
  const g = new THREE.Group();
  g.name = 'accessory-head';
  parent.add(g);
  const dark = mat('#1f2937', { rough: 0.4, metal: 0.2 });
  const metal = mat(accent, { rough: 0.35, metal: 0.7 });
  const lensR = R * 0.32;

  switch (id) {
    case 'glasses':
      put(g, torus(lensR, R * 0.035, 8, 20), dark, [R * 0.38, R * 0.06, R * 0.92]);
      put(g, torus(lensR, R * 0.035, 8, 20), dark, [-R * 0.38, R * 0.06, R * 0.92]);
      put(g, box(R * 0.32, R * 0.05, R * 0.05), dark, [0, R * 0.06, R * 0.92]);
      put(g, box(R * 0.05, R * 0.05, R * 0.75), dark, [R * 0.72, R * 0.1, R * 0.5]);
      put(g, box(R * 0.05, R * 0.05, R * 0.75), dark, [-R * 0.72, R * 0.1, R * 0.5]);
      break;
    case 'sunglasses': {
      const m = mat('#0b1220', { rough: 0.25, metal: 0.35 });
      put(g, sphere(R * 0.34), m, [R * 0.38, R * 0.08, R * 0.86], [0, 0, 0], [1, 0.75, 0.45]);
      put(g, sphere(R * 0.34), m, [-R * 0.38, R * 0.08, R * 0.86], [0, 0, 0], [1, 0.75, 0.45]);
      put(g, box(R * 0.34, R * 0.05, R * 0.05), m, [0, R * 0.12, R * 0.9]);
      break;
    }
    case 'cap': {
      const m = mat(accent, { rough: 0.85 });
      put(g, cap(R * 1.06, Math.PI * 0.52), m, [0, r0(R), 0], [0, 0, 0], [1, sy * 1.05, 1.05]);
      put(g, cyl(R * 1.1, R * 1.1, R * 0.06, 24), m, [0, R * 0.1, R * 0.8], [0.12, 0, 0], [1, 1, 1.1]);
      break;
    }
    case 'sunhat': {
      const m = mat('#e6d3a3', { rough: 0.9 });
      put(g, cyl(R * 2.3, R * 2.3, R * 0.05, 28), m, [0, R * 0.35, 0]);
      put(g, cap(R * 1.2, Math.PI * 0.5), m, [0, R * 0.3, 0], [0, 0, 0], [1, sy, 1]);
      put(g, cyl(R * 1.21, R * 1.21, R * 0.16, 24), mat(accent), [0, R * 0.28, 0]);
      break;
    }
    case 'hardhat': {
      const m = mat(accent, { rough: 0.45 });
      put(g, cap(R * 1.18, Math.PI * 0.46), m, [0, r0(R), 0], [0, 0, 0], [1, sy, 1.06]);
      put(g, box(R * 1.1, R * 0.08, R * 0.7), m, [0, R * 0.22, R * 0.72]);
      put(g, box(R * 0.16, R * 0.42, R * 1.2), m, [0, R * 0.55, 0]);
      break;
    }
    case 'headset': {
      const m = mat('#111827', { rough: 0.5, metal: 0.3 });
      put(g, torus(R * 1.15, R * 0.07, 8, 24), m, [0, R * 0.05, 0], [Math.PI / 2, 0, 0]);
      put(g, cyl(R * 0.3, R * 0.3, R * 0.22, 16), m, [R * 1.12, -R * 0.05, 0], [0, 0, Math.PI / 2]);
      put(g, cyl(R * 0.3, R * 0.3, R * 0.22, 16), m, [-R * 1.12, -R * 0.05, 0], [0, 0, Math.PI / 2]);
      put(g, capsule(R * 0.035, R * 0.5), m, [R * 0.85, -R * 0.35, R * 0.5], [0.5, 0, 0.3]);
      break;
    }
    case 'earring':
      put(g, torus(R * 0.12, R * 0.035, 8, 16), metal, [R * 1.0, -R * 0.28, R * 0.05], [0, 0, Math.PI / 2]);
      put(g, torus(R * 0.12, R * 0.035, 8, 16), metal, [-R * 1.0, -R * 0.28, R * 0.05], [0, 0, Math.PI / 2]);
      break;
    default:
      break;
  }
  return g;
}

/** Phụ kiện gắn vào thân: necklace, scarf, backpack. */
export function buildBodyAccessory(parent, id, P, accent = '#f59e0b') {
  const g = new THREE.Group();
  g.name = 'accessory-body';
  parent.add(g);

  switch (id) {
    case 'necklace':
      put(g, torus(P.h * 0.34, P.h * 0.045, 8, 20), mat(accent, { metal: 0.8, rough: 0.3 }),
        [0, P.torsoH - P.h * 0.05, P.torsoD * 0.35], [Math.PI / 2.4, 0, 0]);
      break;
    case 'scarf':
      put(g, torus(P.h * 0.4, P.h * 0.14, 10, 22), clothMat(accent),
        [0, P.torsoH - P.h * 0.02, 0], [Math.PI / 2, 0, 0]);
      put(g, box(P.h * 0.28, P.h * 0.9, P.h * 0.1), clothMat(accent),
        [P.h * 0.1, P.torsoH - P.h * 0.6, P.torsoD * 0.5]);
      break;
    case 'backpack':
      put(g, box(P.torsoW * 1.15, P.torsoH * 0.62, P.torsoD * 0.7), clothMat(accent),
        [0, P.torsoH * 0.6, -P.torsoD * 0.85]);
      put(g, box(P.torsoW * 0.9, P.torsoH * 0.16, P.torsoD * 0.3), clothMat(darken(accent, 0.7)),
        [0, P.torsoH * 0.45, -P.torsoD * 0.62]);
      put(g, box(P.h * 0.07, P.torsoH * 0.7, P.h * 0.07), clothMat(darken(accent, 0.7)),
        [P.torsoW * 0.45, P.torsoH * 0.7, -P.torsoD * 0.5], [0.2, 0, 0]);
      put(g, box(P.h * 0.07, P.torsoH * 0.7, P.h * 0.07), clothMat(darken(accent, 0.7)),
        [-P.torsoW * 0.45, P.torsoH * 0.7, -P.torsoD * 0.5], [0.2, 0, 0]);
      break;
    default:
      break;
  }
  return g;
}


/**
 * Dựng nhân vật hoàn chỉnh.
 * @returns {{group:THREE.Group, parts:object, update:(t:number,animate?:boolean)=>void, dispose:()=>void}}
 */
export function buildCharacter(p) {
  const P = proportions(p);
  const root = new THREE.Group();
  root.name = 'character';

  const skinM = skinMat(p.skin);
  const skinShadeM = skinMat(p.skinShade ?? p.skin);
  const topM = clothMat(p.top);
  const bottomM = clothMat(p.bottom);
  const shoeM = rubberMat(p.shoes);
  const eyeM = mat(p.eye, { rough: 0.25 });
  const whiteM = mat('#f7f7f7', { rough: 0.4 });

  // ── CHÂN ────────────────────────────────────────────────
  const legs = new THREE.Group();
  legs.name = 'legs';
  legs.position.y = P.legH;
  root.add(legs);

  const thighLen = P.legH * 0.49;
  const shoeH = P.h * 0.2;
  // Tổng chiều dài đùi + cẳng + đế giày = P.legH để đế giày chạm đúng mặt sàn (y = 0).
  const shinLen = P.legH - thighLen - shoeH;
  const legPivots = [];

  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.name = side > 0 ? 'leg.R' : 'leg.L';
    leg.position.set(side * P.hipW * 0.28, 0, 0);
    legs.add(leg);
    put(leg, capsule(P.thighR, Math.max(0.01, thighLen - P.thighR * 2)), bottomM, [0, -thighLen / 2, 0]);
    const knee = new THREE.Group();
    knee.position.y = -thighLen;
    leg.add(knee);
    put(knee, capsule(P.shinR, Math.max(0.01, shinLen - P.shinR * 2)), bottomM, [0, -shinLen / 2, 0]);
    const shoe = put(knee, box(P.shinR * 1.8, shoeH, P.footL), shoeM, [0, -shinLen - shoeH / 2, P.footL * 0.3]);
    legPivots.push({ leg, knee, shoe, side });
  }

  // ── THÂN ────────────────────────────────────────────────
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = P.legH;
  root.add(torso);

  put(torso, capsule(P.hipW * 0.5, P.h * 0.45), bottomM, [0, P.h * 0.18, 0], [0, 0, 0], [1, 1, 1.15]);
  const shirtH = P.torsoH * 0.86;
  const chest = put(torso, capsule(P.torsoW * 0.5, Math.max(0.01, shirtH - P.torsoW), 18), topM,
    [0, P.torsoH * 0.55, 0], [0, 0, 0], [1, 1, P.torsoD / P.torsoW]);
  put(torso, box(P.shoulderW * 0.82, P.h * 0.07, P.torsoD * 0.35), topM,
    [0, P.torsoH * 0.94, P.torsoD * 0.32], [0.12, 0, 0]);
  put(torso, cyl(P.h * 0.2, P.h * 0.24, P.neckH * 1.5), skinShadeM, [0, P.torsoH + P.neckH * 0.4, 0]);

  // ── ĐẦU ─────────────────────────────────────────────────
  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = P.torsoH + P.neckH * 1.1;
  torso.add(head);

  const sy = Math.min(1.16, Math.max(0.86, 0.88 + ((p.faceRatio ?? 1.2) - 1.05) * 0.4));
  const jaw = 0.92 + (p.jawWidth ?? 0.95) * 0.1;
  const skull = new THREE.Group();
  skull.position.y = P.headR * sy;
  head.add(skull);

  put(skull, sphere(P.headR), skinM, [0, 0, 0], [0, 0, 0], [jaw, sy, 0.95]);
  put(skull, sphere(P.headR * 0.16), skinShadeM, [P.headR * 0.99, 0, 0], [0, 0, 0], [0.4, 1, 0.8]);
  put(skull, sphere(P.headR * 0.16), skinShadeM, [-P.headR * 0.99, 0, 0], [0, 0, 0], [0.4, 1, 0.8]);

  for (const side of [-1, 1]) {
    put(skull, sphere(P.headR * 0.17), whiteM, [side * P.headR * 0.34, P.headR * 0.1, P.headR * 0.84],
      [0, 0, 0], [1, 0.75, 0.5]);
    put(skull, sphere(P.headR * 0.12), eyeM, [side * P.headR * 0.34, P.headR * 0.1, P.headR * 0.92],
      [0, 0, 0], [1, 0.85, 0.6]);
    put(skull, box(P.headR * 0.3, P.headR * 0.05, P.headR * 0.06), hairMat(p.hair),
      [side * P.headR * 0.34, P.headR * 0.32, P.headR * 0.86], [0, 0, side * -0.12]);
  }
  put(skull, sphere(P.headR * 0.09), skinShadeM, [0, -P.headR * 0.08, P.headR * 0.98], [0, 0, 0], [1, 1, 0.8]);
  put(skull, new THREE.TorusGeometry(P.headR * 0.2, P.headR * 0.026, 6, 18, Math.PI),
    mat('#8f4f4f', { rough: 0.6 }), [0, -P.headR * 0.4, P.headR * 0.86], [0, 0, Math.PI]);

  buildHair(skull, p.hairMesh, P.headR, sy, p.hair);
  buildFacialHair(skull, p.facialHairMesh, P.headR, p.hair);
  buildHeadAccessory(skull, p.accessoryMesh, P.headR, sy, p.accent);

  // ── TAY ─────────────────────────────────────────────────
  const armPivots = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.name = side > 0 ? 'arm.R' : 'arm.L';
    arm.position.set(side * P.shoulderW * 0.46, P.torsoH * 0.9, 0);
    torso.add(arm);
    put(arm, sphere(P.upperArmR * 1.3), topM);
    put(arm, capsule(P.upperArmR, Math.max(0.01, P.upperArmL - P.upperArmR * 2)), topM, [0, -P.upperArmL / 2, 0]);
    const elbow = new THREE.Group();
    elbow.position.y = -P.upperArmL;
    arm.add(elbow);
    put(elbow, capsule(P.foreArmR, Math.max(0.01, P.foreArmL - P.foreArmR * 2)), skinM, [0, -P.foreArmL / 2, 0]);
    put(elbow, box(P.foreArmR * 2, P.foreArmL * 0.32, P.foreArmR * 1.3), skinShadeM, [0, -P.foreArmL * 1.06, 0], [0.12, 0, 0]);
    if (p.accessoryMesh === 'watch' && side > 0) {
      put(elbow, cyl(P.foreArmR * 1.12, P.foreArmR * 1.12, P.h * 0.045, 18),
        mat(p.accent, { metal: 0.7, rough: 0.3 }), [0, -P.foreArmL * 0.92, 0], [0, 0, Math.PI / 2]);
    }
    armPivots.push({ arm, elbow, side });
  }

  buildBodyAccessory(torso, p.accessoryMesh, P, p.accent);

  // ── TƯ THẾ & ANIMATION ──────────────────────────────────
  const stoop = (p.ageFactor ?? 0) * 0.05;
  const armBase = (side) => (p.gender === 'nu' ? 0.09 : 0.12) * side;

  /**
   * Cập nhật tư thế. animate=false => trả về tư thế tĩnh (dùng khi tắt animation).
   */
  function update(t = 0, animate = true) {
    const time = animate ? t : 0;
    const k = animate ? 1 : 0;
    root.position.y = Math.max(0, Math.sin(time * 1.6)) * 0.006 * k;
    torso.rotation.x = stoop + Math.sin(time * 1.6 + 0.4) * 0.008 * k;
    torso.rotation.y = Math.sin(time * 0.45) * 0.06 * k;
    chest.scale.x = 1 + Math.sin(time * 1.6) * 0.012 * k;
    head.rotation.y = Math.sin(time * 0.75) * 0.12 * k;
    head.rotation.x = Math.sin(time * 1.15) * 0.035 * k;
    for (const { arm, elbow, side } of armPivots) {
      arm.rotation.z = armBase(side) + Math.sin(time * 1.4 + side) * 0.03 * k;
      arm.rotation.x = Math.sin(time * 1.4 + side * 0.5) * 0.06 * k;
      elbow.rotation.x = -0.18 + Math.sin(time * 1.3 + side) * 0.05 * k;
    }
    for (const { leg, knee, shoe, side } of legPivots) {
      leg.rotation.z = side * 0.015;
      knee.rotation.x = 0.03 + Math.abs(Math.sin(time * 0.8)) * 0.01 * k;
      // Bù góc chùng đầu gối để bàn chân luôn phẳng, đế giày chạm sàn (y = 0).
      if (shoe) shoe.rotation.x = -knee.rotation.x;
    }
  }

  /** Giải phóng geometry/material (gọi khi bỏ nhân vật khỏi scene). */
  function dispose() {
    root.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
      }
    });
  }

  update(0, false);
  return {
    group: root,
    parts: { torso, head, skull, chest, legs, arms: armPivots, legPivots },
    P,
    update,
    dispose,
  };
}


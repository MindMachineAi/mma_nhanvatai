/**
 * selftest3d.mjs — Kiểm tra bộ dựng hình three.js (figure.js) chạy headless.
 * Chạy:  node tools/selftest3d.mjs
 */
import { createRequire } from 'node:module';

// three.js được cài trong web/node_modules -> nạp qua createRequire để chạy được từ thư mục tools/.
const require = createRequire(new URL('../web/package.json', import.meta.url));
const THREE = require('three');
import { buildCharacter, proportions } from '../web/src/viewer/figure.js';
import { generateCharacter, overrideCharacter } from '../web/src/engine/characterEngine.js';
import { HAIR_STYLES, FACIAL_HAIR, EYE_COLORS, BUILDS } from '../web/src/engine/tables.js';
import { ACCESSORIES, OUTFITS } from '../web/src/engine/tables2.js';

let pass = 0;
let fail = 0;
function check(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

/** Đo hộp bao của một nhân vật đã dựng. */
function measure(figure) {
  const box = new THREE.Box3().setFromObject(figure.group);
  let meshes = 0;
  let bad = 0;
  figure.group.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      const pos = o.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i++) if (!Number.isFinite(pos[i])) { bad++; break; }
      const sc = o.scale;
      if (!Number.isFinite(sc.x) || !Number.isFinite(sc.y) || !Number.isFinite(sc.z)) bad++;
    }
  });
  return { meshes, bad, minY: box.min.y, maxY: box.max.y, sizeX: box.max.x - box.min.x, sizeZ: box.max.z - box.min.z };
}

console.log('\n=== 1. Dựng nhân vật mặc định ===');
const base = generateCharacter({ seed: 'NV-3D-01' });
const f0 = buildCharacter(base.threeD);
const m0 = measure(f0);
console.log(`     số mesh: ${m0.meshes}, cao ${m0.minY.toFixed(3)}..${m0.maxY.toFixed(3)} m, rộng ${m0.sizeX.toFixed(2)} m`);
check('không có hình học NaN', m0.bad === 0, `(${m0.bad} mesh lỗi)`);
check('số mesh hợp lý (> 25)', m0.meshes > 25, `(${m0.meshes})`);
check('bàn chân nằm trên sàn (minY >= -0.002)', m0.minY >= -0.002, `(minY=${m0.minY.toFixed(4)})`);
check('chiều cao khớp tham số (±7cm)', Math.abs(m0.maxY - base.threeD.heightM) < 0.07,
  `(maxY=${m0.maxY.toFixed(3)} vs heightM=${base.threeD.heightM})`);
check('độ sâu cơ thể hợp lý (0.15..0.6m)', m0.sizeZ > 0.15 && m0.sizeZ < 0.6, `(${m0.sizeZ.toFixed(3)})`);

console.log('\n=== 1b. Truy tìm mesh thấp nhất ===');
{
  const fig = buildCharacter(base.threeD);
  const lows = [];
  fig.group.updateMatrixWorld(true);
  fig.group.traverse((o) => {
    if (!o.isMesh) return;
    const b = new THREE.Box3().setFromObject(o);
    lows.push([b.min.y, o.name || o.geometry.type, o.parent.name, o.position.toArray().map((v) => +v.toFixed(4)).join(',')]);
  });
  lows.sort((a, b) => a[0] - b[0]);
  for (const [y, nm, pn, pos] of lows.slice(0, 6)) {
    console.log(`     y=${y.toFixed(4)}  ${nm} <${pn}>  pos=(${pos})`);
  }
  fig.dispose();
}

console.log('\n=== 2. Tất cả kiểu tóc ===');
for (const hair of HAIR_STYLES) {
  const ch = overrideCharacter(generateCharacter({ seed: 'NV-HAIR' }), { appearance: { hairStyle: hair.id } });
  const fig = buildCharacter(ch.threeD);
  const m = measure(fig);
  check(`tóc ${hair.id}`, m.bad === 0 && m.meshes > 20, `(mesh ${m.meshes}, lỗi ${m.bad})`);
  fig.dispose();
}

console.log('\n=== 3. Tất cả râu ===');
for (const fh of FACIAL_HAIR) {
  const ch = overrideCharacter(generateCharacter({ seed: 'NV-BEARD' }), { appearance: { facialHair: fh.id } });
  const fig = buildCharacter(ch.threeD);
  const m = measure(fig);
  check(`râu ${fh.mesh}`, m.bad === 0, `(lỗi ${m.bad})`);
  fig.dispose();
}

console.log('\n=== 4. Tất cả phụ kiện ===');
for (const acc of ACCESSORIES) {
  const ch = overrideCharacter(generateCharacter({ seed: 'NV-ACC' }), { accessory: acc.id });
  const fig = buildCharacter(ch.threeD);
  const m = measure(fig);
  check(`phụ kiện ${acc.mesh}`, m.bad === 0 && m.meshes > 20, `(mesh ${m.meshes}, lỗi ${m.bad})`);
  fig.dispose();
}

console.log('\n=== 5. Tất cả màu mắt & bộ trang phục ===');
for (const eye of EYE_COLORS) {
  const ch = overrideCharacter(generateCharacter({ seed: 'NV-EYE' }), { appearance: { eyeColor: eye.id } });
  const fig = buildCharacter(ch.threeD);
  check(`mắt ${eye.id} -> ${ch.threeD.eye}`, fig.parts.head.children.length > 0);
  fig.dispose();
}
for (const [key, outfit] of Object.entries(OUTFITS)) {
  const ch = generateCharacter({ seed: `NV-OUTFIT-${key}` });
  ch.threeD.top = outfit.palette[0];
  ch.threeD.bottom = outfit.palette[1];
  ch.threeD.accent = outfit.palette[2];
  const fig = buildCharacter(ch.threeD);
  const m = measure(fig);
  check(`trang phục ${key}`, m.bad === 0);
  fig.dispose();
}

console.log('\n=== 6. Tư thế & animation ===');
const figA = buildCharacter(base.threeD);
const armR = figA.parts.arms[1].arm;
const before = armR.rotation.z;
figA.update(0, false);
const still = armR.rotation.z;
figA.update(0.7, true);
const moved = armR.rotation.z;
const rotBefore = figA.parts.head.rotation.y;
figA.update(1.9, true);
const rotAfter = figA.parts.head.rotation.y;
check('tắt animation -> tư thế tĩnh', Math.abs(still - before) < 1e-9);
check('bật animation -> tay đổi góc', Math.abs(moved - still) > 1e-6, `(${still.toFixed(4)} -> ${moved.toFixed(4)})`);
check('đầu quay theo thời gian', Math.abs(rotAfter - rotBefore) > 1e-6, `(${rotBefore.toFixed(4)} -> ${rotAfter.toFixed(4)})`);

console.log('\n=== 7. Tỉ lệ theo vóc dáng ===');
const widths = [];
for (const b of BUILDS) {
  const ch = overrideCharacter(generateCharacter({ seed: 'NV-BUILD' }), { appearance: { build: b.id } });
  const P = proportions(ch.threeD);
  const fig = buildCharacter(ch.threeD);
  const m = measure(fig);
  widths.push(P.torsoW);
  console.log(`     ${b.id}: rộng thân ${P.torsoW.toFixed(3)}m, cao ${m.maxY.toFixed(3)}m, minY ${m.minY.toFixed(4)}`);
  check(`vóc dáng ${b.id} dựng được, chân chạm sàn`, m.bad === 0 && m.minY >= -0.002, `(minY=${m.minY.toFixed(4)}, lỗi=${m.bad})`);
  fig.dispose();
}
check('vóc dáng to hơn -> thân rộng hơn', widths.every((w, i) => i === 0 || w >= widths[i - 1]), `(${widths.map((w) => w.toFixed(3)).join(' < ')})`);

console.log('\n=== 8. Hiệu năng dựng 100 nhân vật ===');
const t0 = Date.now();
let total = 0;
for (let i = 0; i < 100; i++) {
  const ch = generateCharacter({ seed: `NV-PERF-${i}` });
  const fig = buildCharacter(ch.threeD);
  total += fig.parts.arms.length + fig.parts.legPivots.length;
  fig.dispose();
}
const ms = Date.now() - t0;
console.log(`     100 nhân vật trong ${ms} ms (${(ms / 100).toFixed(1)} ms/nhân vật)`);
check('dựng 100 nhân vật < 6000ms', ms < 6000, `(${ms}ms)`);

console.log(`\n═══ KẾT QUẢ 3D: ${pass} PASS / ${fail} FAIL ═══\n`);
process.exit(fail === 0 ? 0 : 1);

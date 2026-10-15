/**
 * selftest.mjs — Kiểm tra nhanh Character Engine bằng Node (không cần browser).
 * Chạy:  node tools/selftest.mjs
 */
import {
  generateCharacter, overrideCharacter, normalizeSpec, FIELD_OPTIONS,
} from '../web/src/engine/characterEngine.js';

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

console.log('\n=== 1. Tất định theo seed ===');
const a = generateCharacter({ seed: 'NV-TEST01' });
const b = generateCharacter({ seed: 'NV-TEST01' });
const c = generateCharacter({ seed: 'NV-TEST02' });
check('cùng seed -> cùng id', a.id === b.id, `(${a.id} vs ${b.id})`);
check('cùng seed -> cùng JSON lõi', JSON.stringify(a.identity) === JSON.stringify(b.identity));
check('khác seed -> khác id', a.id !== c.id);

console.log('\n=== 2. Ràng buộc (constraint) ===');
const occ = generateCharacter({ seed: 'NV-TEST01', occupationId: 'bac_si' });
const gen = generateCharacter({ seed: 'NV-TEST01', genderId: 'nu' });
check('ép nghề nghiệp = bác sĩ', occ.identity.occupation === 'bac_si');
check('ép giới tính = nữ', gen.identity.gender === 'nu');
check('nghề bác sĩ -> trang phục y tế', occ.outfit.style === 'medical');

console.log('\n=== 3. Trường dẫn xuất ===');
check('có id', typeof a.id === 'string' && a.id.startsWith('nv-'));
check('có mô tả tiếng Việt >= 3 đoạn', a.description.split('\n\n').length === 3);
check('có prompt tiếng Anh', a.prompt.includes('Portrait of') && a.prompt.length > 100);
check('có tham số 3D', a.threeD && typeof a.threeD.heightM === 'number' && a.threeD.heightM > 1.4);
check('3D có màu da + màu tóc', /^#/.test(a.threeD.skin) && /^#/.test(a.threeD.hair));
check('có nhãn tiếng Việt', !!a.labels.occupation && !!a.labels.hairStyle);
check('chỉ số RPG trong khoảng 1..20', Object.values(a.rpg.stats).every((v) => v >= 1 && v <= 20));
check('traits 3..5 phần tử', a.personality.traits.length >= 3 && a.personality.traits.length <= 5);

console.log('\n=== 4. Chỉnh tay (override) ===');
const edited = overrideCharacter(a, { appearance: { hairStyle: 'bui_to', heightCm: 200 } });
check('đổi kiểu tóc', edited.appearance.hairStyle === 'bui_to');
check('đổi chiều cao', edited.appearance.heightCm === 200);
check('đổi chiều cao -> đổi heightM trong 3D', edited.threeD.heightM === 2);
check('đổi trường -> đổi id', edited.id !== a.id);
const occSwitch = overrideCharacter(a, { identity: { occupation: 'dau_bep' } });
check('đổi nghề -> đồng bộ trang phục bếp', occSwitch.outfit.style === 'chef');
check('đổi nghề -> cập nhật nhãn', occSwitch.labels.occupation === 'Đầu bếp');

console.log('\n=== 5. Nhập/xuất JSON (normalizeSpec) ===');
const roundtrip = normalizeSpec(JSON.parse(JSON.stringify(a)));
check('normalize giữ nguyên id', roundtrip.id === a.id, `(${roundtrip.id} vs ${a.id})`);
check('normalize lấp được trường thiếu', (() => {
  const broken = JSON.parse(JSON.stringify(a));
  delete broken.appearance.hairColor;
  delete broken.style;
  const fixed = normalizeSpec(broken);
  return !!fixed.appearance.hairColor && !!fixed.style;
})());
let threw = false;
try { normalizeSpec({ foo: 1 }); } catch { threw = true; }
check('JSON sai -> ném lỗi rõ ràng', threw);

console.log('\n=== 6. Đa dạng hoá (100 nhân vật) ===');
const set = new Set();
const names = new Set();
let male = 0;
let female = 0;
for (let i = 0; i < 100; i++) {
  const ch = generateCharacter({ seed: `NV-BULK-${i}` });
  set.add(ch.id);
  names.add(ch.identity.fullName);
  if (ch.identity.gender === 'nam') male++;
  if (ch.identity.gender === 'nu') female++;
}
check('100 nhân vật -> 100 id khác nhau', set.size === 100, `(chỉ ${set.size})`);
check('không trùng tên quá nhiều', names.size >= 85, `(${names.size} tên)`);
check('có cả nam và nữ', male > 20 && female > 20, `(nam ${male}, nữ ${female})`);

console.log('\n=== 7. Bảng lựa chọn cho UI ===');
check('có 26 nghề nghiệp', FIELD_OPTIONS.occupation.length === 26, `(${FIELD_OPTIONS.occupation.length})`);
check('có 12 kiểu tóc', FIELD_OPTIONS.hairStyle.length === 12);
check('có 4 phong cách ảnh', FIELD_OPTIONS.style.length === 4);

console.log('\n───────────── MẪU NHÂN VẬT ─────────────');
console.log(`Tên      : ${a.identity.fullName} (${a.identity.genderLabel}, ${a.identity.age} tuổi)`);
console.log(`Nghề     : ${a.identity.occupationLabel} — quê ${a.identity.hometown}`);
console.log(`Ngoại hình: ${a.appearance.heightCm}cm, ${a.labels.build}, da ${a.labels.skinTone}, tóc ${a.labels.hairStyle} ${a.labels.hairColor}`);
console.log(`Trang phục: ${a.labels.outfit} (${a.outfit.palette.primary} / ${a.outfit.palette.secondary} / ${a.outfit.palette.accent})`);
console.log(`Phụ kiện   : ${a.labels.accessory}`);
console.log(`Tính cách : ${a.labels.archetype} — ${a.personality.traits.join(', ')}`);
console.log(`RPG       : cấp ${a.rpg.level} — ${JSON.stringify(a.rpg.stats)}`);
console.log(`3D        : ${JSON.stringify(a.threeD)}`);
console.log(`PROMPT    : ${a.prompt}`);
console.log(`\n${a.description}\n`);

console.log(`\n═══ KẾT QUẢ: ${pass} PASS / ${fail} FAIL ═══\n`);
process.exit(fail === 0 ? 0 : 1);

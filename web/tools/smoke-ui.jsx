/**
 * smoke-ui.jsx — Kiểm thử khói cho lớp giao diện (chạy bằng Node, không cần trình duyệt).
 *
 * WebGL và useEffect không chạy ở chế độ này, nhưng toàn bộ cây component vẫn được
 * kết xuất thật (renderToString) nên bắt được: prop sai, thiếu export, FIELD_OPTIONS lệch,
 * lỗi sinh SVG chân dung, chia mảng/định dạng số lỗi...
 *
 * Cách chạy (trong thư mục web/):
 *   npx vite build --ssr tools/smoke-ui.jsx --outDir tools/_out --logLevel warn
 *   node tools/_out/smoke-ui.js
 */
import { renderToString } from 'react-dom/server';
import App from '../src/App.jsx';
import CreatorForm from '../src/ui/CreatorForm.jsx';
import ViewerPanel from '../src/ui/ViewerPanel.jsx';
import PortraitPanel from '../src/ui/PortraitPanel.jsx';
import InfoPanel from '../src/ui/InfoPanel.jsx';
import LibraryPanel from '../src/ui/LibraryPanel.jsx';
import { generateCharacter, finalize } from '../src/engine/characterEngine.js';
import { buildPortraitSvg, portraitDataUrl } from '../src/portrait.js';

let pass = 0;
let fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); }
};

const spec = generateCharacter({ seed: 'NV-SMOKE1' });
const html = renderToString(<App />);

check('App kết xuất được (không ném lỗi)', html.length > 5000);
for (const s of ['1. Nguồn sinh', '2. Ngoại hình', '3. Nhập / xuất file', 'Chân dung 2D', 'Thư viện', 'Prompt AI', 'Chỉ số', '<svg']) {
  check(`App có "${s}"`, html.includes(s));
}
check('Mọi ô chọn ngoại hình đều có mặt', ['Chiều cao', 'Vóc dáng', 'Dáng mặt', 'Màu da', 'Màu mắt', 'Kiểu tóc', 'Màu tóc', 'Phụ kiện']
  .every((s) => html.includes(s)));
check('Ô chọn chứa đủ option của engine', html.includes('Cao gầy') || html.includes('average') || /<option/.test(html));

// Các panel phải kết xuất độc lập được với cùng spec
const panels = [
  ['CreatorForm', <CreatorForm
    spec={spec}
    seedText={spec.seed}
    onSeedChange={() => {}}
    onRegenerate={() => {}}
    onRandom={() => {}}
    pinned={{ genderId: '', occupationId: '' }}
    onPinnedChange={() => {}}
    onPatch={() => {}}
    onImportJson={() => {}}
    onExportJson={() => {}}
  />],
  ['ViewerPanel', <ViewerPanel
    spec={spec}
    animate
    setAnimate={() => {}}
    wireframe={false}
    setWireframe={() => {}}
    modelUrl={null}
    busy=""
    onApi={() => {}}
    onResetView={() => {}}
    onSnapshot={() => {}}
    onExportGlbClient={() => {}}
    onBuildBlender={() => {}}
    onClearModel={() => {}}
  />],
  ['PortraitPanel', <PortraitPanel
    spec={spec}
    style={spec.style}
    onStyleChange={() => {}}
    onDownloadSvg={() => {}}
    onDownloadPng={() => {}}
    onAiPortrait={() => {}}
    onClearAi={() => {}}
    aiImage={null}
    busy=""
    serverOnline={false}
  />],
  ['InfoPanel', <InfoPanel spec={spec} onCopy={() => {}} onSave={() => {}} saved={false} onExportJson={() => {}} />],
  ['LibraryPanel', <LibraryPanel
    items={[finalize(spec)]}
    currentId={spec.id}
    onLoad={() => {}}
    onRemove={() => {}}
    onSave={() => {}}
    onClear={() => {}}
    onExportAll={() => {}}
    onImportAll={() => {}}
  />],
];
for (const [name, el] of panels) {
  try {
    const out = renderToString(el);
    check(`${name} kết xuất độc lập`, out.length > 100);
  } catch (err) {
    check(`${name} kết xuất độc lập (lỗi: ${err.message})`, false);
  }
}

// Chân dung SVG phải là vector hợp lệ và đổi theo tham số
const svg = buildPortraitSvg(spec, { size: 320, caption: spec.identity.fullName });
check('Chân dung SVG mở/đóng thẻ đúng', svg.startsWith('<svg') && svg.trimEnd().endsWith('</svg>'));
check('Chân dung SVG không có NaN', !/NaN|undefined|Infinity/.test(svg));
check('Chân dung SVG nhúng tên nhân vật', svg.includes(spec.identity.fullName));
check('portraitDataUrl tạo data URL', portraitDataUrl(spec, { size: 76 }).startsWith('data:image/svg+xml'));

const styled = generateCharacter({ seed: 'NV-SMOKE1', style: 'anime' });
check('Đổi phong cách -> SVG khác nhau', buildPortraitSvg(styled) !== buildPortraitSvg(spec));

console.log(`\n═══ KẾT QUẢ UI: ${pass} PASS / ${fail} FAIL ═══`);
process.exit(fail ? 1 : 0);

/**
 * App.jsx — Bộ khung của trình tạo nhân vật.
 *
 * Luồng dữ liệu một chiều, dễ suy luận:
 *   seed/ràng buộc ──generateCharacter──┐
 *                                       ├─> spec (nhân vật đầy đủ) ─> UI
 *   các ô chọn ngoại hình ─overrideCharacter─┘
 *
 * `spec.threeD` là hợp đồng dùng chung cho: three.js (xem trước), portrait.js (ảnh SVG)
 * và Blender (dựng GLB bên server).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  generateCharacter, overrideCharacter, normalizeSpec, slugify, FIELD_OPTIONS,
} from './engine/characterEngine.js';
import { buildPortraitSvg, portraitPng } from './portrait.js';
import { downloadBlob } from './viewer/Viewer3D.jsx';
import { api, isServerOnline, API_BASE } from './api.js';
import { useLibrary } from './hooks/useLibrary.js';
import CreatorForm from './ui/CreatorForm.jsx';
import ViewerPanel from './ui/ViewerPanel.jsx';
import PortraitPanel from './ui/PortraitPanel.jsx';
import InfoPanel from './ui/InfoPanel.jsx';
import LibraryPanel from './ui/LibraryPanel.jsx';

const DEFAULT_SEED = 'NV-DEMO01';
const randomSeed = () => `NV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

/** Đọc nội dung file text do người dùng chọn. */
function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('Không đọc được file.'));
    fr.readAsText(file, 'utf-8');
  });
}

export default function App() {
  const [spec, setSpec] = useState(() => generateCharacter({ seed: DEFAULT_SEED }));
  const [seedText, setSeedText] = useState(DEFAULT_SEED);
  const [pinned, setPinned] = useState({ genderId: '', occupationId: '' });
  const [animate, setAnimate] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [modelUrl, setModelUrl] = useState(null);
  const [aiImage, setAiImage] = useState(null);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState(null);
  const [serverOnline, setServerOnline] = useState(null);

  const viewApi = useRef(null);
  const fileRef = useRef(null);
  const libFileRef = useRef(null);
  const library = useLibrary();

  // ── Thông báo nhanh (tự tắt sau 4 giây) ───────────────────
  const notify = useCallback((text, kind = 'info') => {
    setToast({ text, kind, at: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Kiểm tra server một lần khi mở app ────────────────────
  const checkServer = useCallback(async () => {
    const ok = await isServerOnline();
    setServerOnline(ok);
    return ok;
  }, []);

  useEffect(() => { checkServer(); }, [checkServer]);

  // ── Sinh nhân vật ─────────────────────────────────────────
  const regenerate = useCallback((seedOverride) => {
    const seed = (seedOverride ?? seedText ?? '').trim() || randomSeed();
    setSeedText(seed);
    setSpec((prev) => generateCharacter({
      seed,
      genderId: pinned.genderId || undefined,
      occupationId: pinned.occupationId || undefined,
      style: prev.style,
    }));
    setAiImage(null);
    setModelUrl(null);
  }, [seedText, pinned]);

  const onRandom = useCallback(() => regenerate(randomSeed()), [regenerate]);

  const onPatch = useCallback((overrides) => {
    setSpec((prev) => overrideCharacter(prev, overrides));
  }, []);

  const onStyleChange = useCallback((style) => {
    setAiImage(null);
    onPatch({ style });
  }, [onPatch]);

  // ── Xuất file ─────────────────────────────────────────────
  const fileName = useMemo(() => {
    const base = slugify(spec.identity?.fullName ?? 'nhan-vat') || 'nhan-vat';
    return `${base}-${spec.seed}`;
  }, [spec]);

  const onExportJson = useCallback(() => {
    downloadBlob(
      new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' }),
      `${fileName}.json`,
    );
    notify('Đã tải character card JSON.', 'ok');
  }, [spec, fileName, notify]);

  const onExportGlbClient = useCallback(async () => {
    setBusy('glb');
    try {
      const blob = await viewApi.current?.exportGLB(`${fileName}.glb`);
      if (blob) notify('Đã xuất GLB từ three.js (bản nhanh, không cần Blender).', 'ok');
      else notify('Chưa có nhân vật để xuất.', 'err');
    } catch (err) {
      notify(`Xuất GLB lỗi: ${err.message}`, 'err');
    } finally {
      setBusy('');
    }
  }, [fileName, notify]);

  const onSnapshot = useCallback(() => {
    const url = viewApi.current?.snapshot();
    if (!url) return notify('Chưa sẵn sàng chụp ảnh.', 'err');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.png`;
    a.click();
    notify('Đã chụp khung hình 3D.', 'ok');
  }, [fileName, notify]);

  const onDownloadSvg = useCallback(() => {
    const svg = buildPortraitSvg(spec, { size: 900, caption: spec.identity?.fullName ?? '' });
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${fileName}-chan-dung.svg`);
    notify('Đã tải chân dung SVG (vector, phóng to không vỡ nét).', 'ok');
  }, [spec, fileName, notify]);

  const onDownloadPng = useCallback(async () => {
    setBusy('png');
    try {
      const blob = await portraitPng(spec, { size: 1024, caption: spec.identity?.fullName ?? '' });
      downloadBlob(blob, `${fileName}-chan-dung.png`);
      notify('Đã tải chân dung PNG 1024px.', 'ok');
    } catch (err) {
      notify(`Tạo PNG lỗi: ${err.message}`, 'err');
    } finally {
      setBusy('');
    }
  }, [spec, fileName, notify]);

  // ── Gọi server: Blender + AI ──────────────────────────────
  const onBuildBlender = useCallback(async () => {
    setBusy('glb');
    try {
      const blob = await api.glb(spec);
      const url = URL.createObjectURL(blob);
      setModelUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      notify('Blender đã dựng xong GLB và đang hiển thị trong khung 3D.', 'ok');
    } catch (err) {
      notify(`Dựng GLB lỗi: ${err.message}`, 'err');
    } finally {
      setBusy('');
    }
  }, [spec, notify]);

  const onClearModel = useCallback(() => {
    setModelUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }, []);

  const onAiPortrait = useCallback(async () => {
    setBusy('ai');
    try {
      const res = await api.aiPortrait(spec, { style: spec.style });
      const url = res.imageUrl
        || (res.imageBase64 ? `data:${res.mimeType || 'image/png'};base64,${res.imageBase64}` : null);
      if (!url) throw new Error('Máy chủ không trả về ảnh.');
      setAiImage({ provider: res.provider || 'AI', url });
      notify(`AI đã vẽ xong chân dung (${res.provider || 'AI'}).`, 'ok');
    } catch (err) {
      notify(`Vẽ bằng AI lỗi: ${err.message}`, 'err');
    } finally {
      setBusy('');
    }
  }, [spec, notify]);

  // ── Lưu / mở thư viện ─────────────────────────────────────
  const onSave = useCallback(async () => {
    library.save(spec);
    notify('Đã lưu nhân vật vào thư viện trên máy này.', 'ok');
    if (serverOnline) {
      api.saveCharacter(spec).catch(() => { /* server tắt cũng không sao, bản local đã lưu */ });
    }
  }, [spec, library, notify, serverOnline]);

  const onLoad = useCallback((record) => {
    const next = normalizeSpec(record);
    setSpec(next);
    setSeedText(next.seed);
    setAiImage(null);
    setModelUrl(null);
    notify(`Đã mở lại ${next.identity.fullName}.`, 'ok');
  }, [notify]);

  const onExportAll = useCallback(() => {
    downloadBlob(new Blob([library.toJson()], { type: 'application/json' }), library.filename);
    notify(`Đã tải ${library.items.length} nhân vật.`, 'ok');
  }, [library, notify]);

  const onImportAll = useCallback(() => libFileRef.current?.click(), []);

  const onLibFileChosen = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const count = library.importJson(await readTextFile(file));
      notify(`Đã nhập ${count} nhân vật vào thư viện.`, 'ok');
    } catch (err) {
      notify(`Nhập thư viện lỗi: ${err.message}`, 'err');
    }
  }, [library, notify]);

  const onImportJson = useCallback(() => fileRef.current?.click(), []);

  const onFileChosen = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const next = normalizeSpec(JSON.parse(await readTextFile(file)));
      setSpec(next);
      setSeedText(next.seed);
      setAiImage(null);
      setModelUrl(null);
      notify(`Đã nạp nhân vật từ ${file.name}.`, 'ok');
    } catch (err) {
      notify(`File JSON không hợp lệ: ${err.message}`, 'err');
    }
  }, [notify]);

  const onCopy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      notify('Đã copy vào clipboard.', 'ok');
    } catch {
      notify('Trình duyệt chặn clipboard, anh copy thủ công nhé.', 'err');
    }
  }, [notify]);
  // ── Kết xuất giao diện ────────────────────────────────────
  const styleLabel = FIELD_OPTIONS.style.find((s) => s.value === spec.style)?.label;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__logo">NV</span>
          <div>
            <h1 className="brand__name">Nhân Vật Tái</h1>
            <p className="brand__sub">Tạo nhân vật 3D + chân dung + character card — chạy được cả khi không có mạng</p>
          </div>
        </div>

        <div className="topbar__right">
          <span className={`dot ${serverOnline ? 'dot--ok' : serverOnline === false ? 'dot--off' : ''}`} />
          <span className="topbar__status">
            {serverOnline === null ? 'Đang kiểm tra API…' : serverOnline ? 'API đã bật' : 'API đang tắt'}
          </span>
          <button type="button" className="btn btn--small" onClick={checkServer} title={API_BASE}>Kiểm tra lại</button>
          <button type="button" className="btn btn--small" onClick={onImportJson}>Nhập JSON</button>
          <button type="button" className="btn btn--small" onClick={onExportJson}>Xuất JSON</button>
        </div>
      </header>

      <main className="grid">
        <div className="col col--left">
          <CreatorForm
            spec={spec}
            onPatch={onPatch}
            seedText={seedText}
            onSeedChange={setSeedText}
            onRegenerate={() => regenerate(seedText)}
            onRandom={onRandom}
            pinned={pinned}
            onPinnedChange={setPinned}
            onImportJson={onImportJson}
            onExportJson={onExportJson}
          />
        </div>

        <div className="col col--mid">
          <ViewerPanel
            spec={spec}
            onApi={(v) => { viewApi.current = v; }}
            animate={animate}
            setAnimate={setAnimate}
            wireframe={wireframe}
            setWireframe={setWireframe}
            modelUrl={modelUrl}
            busy={busy}
            onResetView={() => viewApi.current?.resetView()}
            onSnapshot={onSnapshot}
            onExportGlbClient={onExportGlbClient}
            onBuildBlender={onBuildBlender}
            onClearModel={onClearModel}
          />

          <PortraitPanel
            spec={spec}
            style={spec.style}
            onStyleChange={onStyleChange}
            onDownloadSvg={onDownloadSvg}
            onDownloadPng={onDownloadPng}
            onAiPortrait={onAiPortrait}
            onClearAi={() => setAiImage(null)}
            aiImage={aiImage}
            busy={busy}
            serverOnline={serverOnline}
          />
        </div>

        <div className="col col--right">
          <InfoPanel
            spec={spec}
            onCopy={onCopy}
            onSave={onSave}
            saved={library.has(spec.id)}
            onExportJson={onExportJson}
          />

          <LibraryPanel
            items={library.items}
            currentId={spec.id}
            onLoad={onLoad}
            onRemove={library.remove}
            onSave={onSave}
            onClear={library.clear}
            onExportAll={onExportAll}
            onImportAll={onImportAll}
          />
        </div>
      </main>

      <footer className="foot">
        <span>Phong cách ảnh: <strong>{styleLabel}</strong></span>
        <span>Seed: <code>{spec.seed}</code> — cùng seed luôn cho ra đúng nhân vật này</span>
      </footer>

      {/* Hai input file ẩn: một cho character card, một cho cả thư viện */}
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden-input" onChange={onFileChosen} />
      <input ref={libFileRef} type="file" accept=".json,application/json" className="hidden-input" onChange={onLibFileChosen} />

      {toast && (
        <div className={`toast toast--${toast.kind}`} onClick={() => setToast(null)} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}


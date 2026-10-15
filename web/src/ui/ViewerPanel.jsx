/**
 * ViewerPanel.jsx — Sân khấu 3D: khung xem three.js + thanh công cụ.
 *
 * Nhân vật được dựng NGAY trong trình duyệt bằng figure.js (nhanh, offline).
 * Nếu bấm "Dựng bằng Blender" thì model GLB từ server sẽ được ưu tiên hiển thị.
 */
import Viewer3D from '../viewer/Viewer3D.jsx';
import { FIELD_OPTIONS } from '../engine/characterEngine.js';

function ToolBtn({ children, onClick, active, title, disabled }) {
  return (
    <button
      type="button"
      className={`chip ${active ? 'chip--on' : ''}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default function ViewerPanel({
  spec,
  onApi,
  animate,
  setAnimate,
  wireframe,
  setWireframe,
  modelUrl,
  busy,
  onResetView,
  onSnapshot,
  onExportGlbClient,
  onBuildBlender,
  onClearModel,
}) {
  const tags = [
    spec.labels?.gender,
    `${spec.appearance?.heightCm} cm`,
    spec.labels?.build,
    spec.labels?.outfit,
    spec.personality?.archetypeLabel,
  ].filter(Boolean);

  return (
    <div className="stage">
      <div className="stage__head">
        <div>
          <h2 className="stage__name">{spec.identity?.fullName}</h2>
          <div className="tags">
            {tags.map((t) => <span className="tag" key={t}>{t}</span>)}
            <span className="tag tag--id">{spec.id}</span>
          </div>
        </div>
        <div className="tags tags--right">
          <ToolBtn active={animate} onClick={() => setAnimate((v) => !v)} title="Bật/tắt chuyển động thở">
            {animate ? 'Đang động' : 'Tư thế tĩnh'}
          </ToolBtn>
        </div>
      </div>

      <div className="stage__canvas">
        <Viewer3D
          threeD={spec.threeD}
          animate={animate}
          wireframe={wireframe}
          modelUrl={modelUrl}
          onApi={onApi}
        />
        {modelUrl ? (
          <div className="badge badge--ok">
            Đang xem model Blender
            <button type="button" className="badge__x" onClick={onClearModel} title="Quay về nhân vật dựng bằng three.js">×</button>
          </div>
        ) : (
          <div className="badge">Dựng bằng three.js (tức thời)</div>
        )}
      </div>

      <div className="stage__tools">
        <div className="tools">
          <ToolBtn onClick={onResetView} title="Đưa camera về khung hình chuẩn">Camera mặc định</ToolBtn>
          <ToolBtn active={wireframe} onClick={() => setWireframe((v) => !v)} title="Xem dạng lưới để kiểm tra topology">
            Lưới (wireframe)
          </ToolBtn>
          <ToolBtn onClick={onSnapshot} title="Chụp khung hình hiện tại thành PNG">Chụp ảnh PNG</ToolBtn>
        </div>
        <div className="tools">
          <ToolBtn onClick={onExportGlbClient} title="Xuất GLB từ three.js — không cần server">Tải GLB (nhanh)</ToolBtn>
          <ToolBtn onClick={onBuildBlender} disabled={busy} title="Gọi Blender headless dựng GLB chi tiết hơn (cần API)">
            {busy === 'glb' ? 'Blender đang dựng…' : 'Dựng bằng Blender'}
          </ToolBtn>
        </div>
      </div>

      <p className="stage__note">
        Kéo chuột để xoay, lăn chuột để phóng, chuột phải để dịch chuyển. Nhân vật cao{' '}
        {(spec.threeD?.heightM ?? 1.7).toFixed(2)} m, phong cách {FIELD_OPTIONS.style.find((s) => s.value === spec.style)?.label}.
      </p>
    </div>
  );
}

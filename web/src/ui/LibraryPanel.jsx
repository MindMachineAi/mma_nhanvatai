/**
 * LibraryPanel.jsx — Thư viện nhân vật (localStorage).
 *
 * Thumbnail tái dùng chính portrait.js: mỗi bản ghi được `finalize()` để dựng lại
 * threeD rồi vẽ SVG — nhờ vậy thumbnail luôn khớp với nhân vật thật, không cần lưu ảnh.
 */
import { useMemo } from 'react';
import { finalize } from '../engine/characterEngine.js';
import { portraitDataUrl } from '../portrait.js';

function Thumb({ spec }) {
  const url = useMemo(() => {
    try {
      return portraitDataUrl(finalize(spec), { size: 76 });
    } catch {
      return '';
    }
  }, [spec]);
  return url
    ? <img className="thumb" src={url} alt="" />
    : <span className="thumb thumb--empty">?</span>;
}

export default function LibraryPanel({ items, currentId, onLoad, onRemove, onSave, onClear, onExportAll, onImportAll }) {
  return (
    <div className="library">
      <div className="library__head">
        <h3 className="block__title">Thư viện ({items.length})</h3>
        <div className="row row--tight">
          <button type="button" className="btn btn--small btn--primary" onClick={onSave}>Lưu bản hiện tại</button>
          <button type="button" className="btn btn--small" onClick={onExportAll} disabled={!items.length}>Xuất</button>
          <button type="button" className="btn btn--small" onClick={onImportAll}>Nhập</button>
          <button
            type="button"
            className="btn btn--small btn--danger"
            onClick={onClear}
            disabled={!items.length}
            title="Xoá toàn bộ thư viện trong trình duyệt"
          >
            Xoá hết
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="block__note block__note--dim">
          Chưa có nhân vật nào. Bấm “Lưu bản hiện tại” để cất nhân vật đang xem vào máy này.
        </p>
      ) : (
        <ul className="library__list">
          {items.map((it) => (
            <li key={it.id} className={`lib ${it.id === currentId ? 'lib--on' : ''}`}>
              <button type="button" className="lib__main" onClick={() => onLoad(it)} title="Mở lại nhân vật này">
                <Thumb spec={it} />
                <span className="lib__text">
                  <strong>{it.identity?.fullName}</strong>
                  <span className="lib__sub">
                    {it.identity?.occupationLabel} · {it.appearance?.heightCm} cm · seed {it.seed}
                  </span>
                </span>
              </button>
              <button type="button" className="lib__x" onClick={() => onRemove(it.id)} title="Xoá khỏi thư viện">×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

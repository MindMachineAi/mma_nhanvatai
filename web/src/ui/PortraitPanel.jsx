/**
 * PortraitPanel.jsx — Chân dung 2D: bản SVG tức thời (miễn phí, offline)
 * và lớp nâng cấp bằng AI (Gemini -> MeToken -> Pollinations) khi bấm nút.
 */
import { useMemo } from 'react';
import { buildPortraitSvg } from '../portrait.js';
import { FIELD_OPTIONS } from '../engine/characterEngine.js';

export default function PortraitPanel({
  spec,
  style,
  onStyleChange,
  onDownloadSvg,
  onDownloadPng,
  onAiPortrait,
  onClearAi,
  aiImage,
  busy,
  serverOnline,
}) {
  const svg = useMemo(
    () => buildPortraitSvg(spec, { size: 384, caption: spec.identity?.fullName ?? '' }),
    [spec],
  );

  return (
    <div className="portrait">
      <div className="portrait__frame">
        {aiImage?.url ? (
          <img className="portrait__img" src={aiImage.url} alt={`Chân dung AI của ${spec.identity?.fullName}`} />
        ) : (
          <div className="portrait__img" dangerouslySetInnerHTML={{ __html: svg }} />
        )}
      </div>

      <div className="portrait__side">
        <h3 className="block__title">Chân dung 2D</h3>
        <p className="block__note">
          Bản vẽ SVG được tính từ chính tham số 3D nên luôn khớp nhân vật đang xem — tức thời và không tốn lượt gọi AI.
        </p>

        <div className="chips">
          {FIELD_OPTIONS.style.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`chip ${style === s.value ? 'chip--on' : ''}`}
              onClick={() => onStyleChange(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="row">
          <button type="button" className="btn" onClick={onDownloadSvg}>Tải SVG</button>
          <button type="button" className="btn" onClick={onDownloadPng} disabled={busy === 'png'}>
            {busy === 'png' ? 'Đang tạo…' : 'Tải PNG'}
          </button>
        </div>

        <button
          type="button"
          className="btn btn--primary btn--wide"
          onClick={onAiPortrait}
          disabled={busy === 'ai' || serverOnline === false}
          title={serverOnline === false ? 'Cần bật API để dùng AI' : 'Vẽ lại bằng AI theo đúng prompt của nhân vật'}
        >
          {busy === 'ai' ? 'AI đang vẽ…' : aiImage ? 'Vẽ lại bằng AI' : 'Nâng cấp bằng AI'}
        </button>

        {aiImage ? (
          <p className="block__note">
            Nguồn ảnh: <strong>{aiImage.provider}</strong>.{' '}
            <button type="button" className="linklike" onClick={onClearAi}>Xoá ảnh AI</button>
          </p>
        ) : (
          <p className="block__note block__note--dim">
            {serverOnline === false
              ? 'API chưa bật — nút AI tạm khoá. Bản SVG phía trên vẫn dùng bình thường.'
              : 'AI chỉ vẽ khi bạn bấm nút, để tiết kiệm lượt gọi miễn phí.'}
          </p>
        )}
      </div>
    </div>
  );
}

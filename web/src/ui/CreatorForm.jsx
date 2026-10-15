/**
 * CreatorForm.jsx — Bảng điều khiển bên trái: nguồn sinh, ràng buộc và các ô chọn ngoại hình.
 *
 * Mọi danh mục lấy từ FIELD_OPTIONS của Character Engine -> chỉ có MỘT nguồn dữ liệu
 * duy nhất cho cả engine, viewer 3D, chân dung SVG và API.
 */
import { FIELD_OPTIONS } from '../engine/characterEngine.js';

/** Ô chọn có nhãn. */
function Select({ label, value, onChange, options, hint }) {
  return (
    <label className="field">
      <span className="field__label">
        {label}
        {hint ? <em className="field__hint">{hint}</em> : null}
      </span>
      <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** Ô chọn màu: hiện thêm ô vuông màu để nhận biết nhanh. */
function ColorSelect({ label, value, onChange, options }) {
  const current = options.find((o) => o.value === value);
  return (
    <label className="field">
      <span className="field__label">
        {label}
        {current?.hex ? <i className="swatch" style={{ background: current.hex }} title={current.hex} /> : null}
      </span>
      <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}{o.hex ? ` — ${o.hex}` : ''}</option>
        ))}
      </select>
    </label>
  );
}

/** Nút hành động gọn. */
function Btn({ children, onClick, kind = '', title, disabled }) {
  return (
    <button type="button" className={`btn ${kind}`} onClick={onClick} title={title} disabled={disabled}>
      {children}
    </button>
  );
}

export default function CreatorForm({
  spec,
  seedText,
  onSeedChange,
  onRegenerate,
  onRandom,
  pinned,
  onPinnedChange,
  onPatch,
  onImportJson,
  onExportJson,
}) {
  const ap = spec.appearance ?? {};
  // Chỉnh 1 trường ngoại hình -> engine tính lại mọi trường dẫn xuất (nhãn, mô tả, prompt, 3D)
  const setAp = (key, value) => onPatch?.({ appearance: { [key]: value } });
  const setStyle = (value) => onPatch?.({ style: value });
  const setAccessory = (value) => onPatch?.({ accessory: value });

  return (
    <div className="panel-body">
      <section className="block">
        <h3 className="block__title">1. Nguồn sinh (seed)</h3>
        <p className="block__note">
          Cùng seed + cùng ràng buộc &rarr; cùng nhân vật. Gõ lại seed cũ để tái tạo y hệt.
        </p>
        <div className="row">
          <input
            className="input input--mono"
            value={seedText}
            spellCheck={false}
            onChange={(e) => onSeedChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onRegenerate(); }}
            placeholder="VD: NV-A1B2C3"
          />
          <Btn kind="primary" onClick={onRegenerate} title="Sinh lại từ seed đang gõ">Sinh lại</Btn>
          <Btn onClick={onRandom} title="Seed ngẫu nhiên mới">Ngẫu nhiên</Btn>
        </div>
        <div className="row row--2">
          <Select
            label="Giới tính"
            hint="khoá khi sinh"
            value={pinned.genderId}
            onChange={(v) => onPinnedChange({ ...pinned, genderId: v })}
            options={[{ value: '', label: 'Ngẫu nhiên' }, ...FIELD_OPTIONS.gender]}
          />
          <Select
            label="Nghề nghiệp"
            hint="khoá khi sinh"
            value={pinned.occupationId}
            onChange={(v) => onPinnedChange({ ...pinned, occupationId: v })}
            options={[{ value: '', label: 'Ngẫu nhiên' }, ...FIELD_OPTIONS.occupation]}
          />
        </div>
        <Select
          label="Phong cách ảnh"
          value={spec.style}
          onChange={setStyle}
          options={FIELD_OPTIONS.style}
        />
      </section>

      <section className="block">
        <h3 className="block__title">2. Ngoại hình</h3>
        <p className="block__note">
          &Agrave;nh AI ở trên ghép từ đúng các tham số này &rarr; không bị “vẽ lệch” nhân vật 3D.
        </p>

        <label className="field">
          <span className="field__label">
            Chiều cao
            <em className="field__hint">{ap.heightCm} cm ({((ap.heightCm ?? 170) / 100).toFixed(2)} m)</em>
          </span>
          <input
            className="slider"
            type="range"
            min="140"
            max="210"
            step="1"
            value={ap.heightCm ?? 170}
            onChange={(e) => setAp('heightCm', Number(e.target.value))}
          />
        </label>

        <div className="row row--2">
          <Select label="Vóc dáng" value={ap.build} onChange={(v) => setAp('build', v)} options={FIELD_OPTIONS.build} />
          <Select label="Dáng mặt" value={ap.faceShape} onChange={(v) => setAp('faceShape', v)} options={FIELD_OPTIONS.faceShape} />
        </div>
        <div className="row row--2">
          <ColorSelect label="Màu da" value={ap.skinTone} onChange={(v) => setAp('skinTone', v)} options={FIELD_OPTIONS.skinTone} />
          <ColorSelect label="Màu mắt" value={ap.eyeColor} onChange={(v) => setAp('eyeColor', v)} options={FIELD_OPTIONS.eyeColor} />
        </div>
        <div className="row row--2">
          <Select label="Kiểu tóc" value={ap.hairStyle} onChange={(v) => setAp('hairStyle', v)} options={FIELD_OPTIONS.hairStyle} />
          <ColorSelect label="Màu tóc" value={ap.hairColor} onChange={(v) => setAp('hairColor', v)} options={FIELD_OPTIONS.hairColor} />
        </div>
        <div className="row row--2">
          <Select label="Râu / mặt" value={ap.facialHair} onChange={(v) => setAp('facialHair', v)} options={FIELD_OPTIONS.facialHair} />
          <Select label="Phụ kiện" value={spec.accessory} onChange={setAccessory} options={FIELD_OPTIONS.accessory} />
        </div>
      </section>

      <section className="block">
        <h3 className="block__title">3. Nhập / xuất file</h3>
        <p className="block__note">JSON để lưu &amp; chia sẻ nhân vật; GLB để mang sang game/engine khác.</p>
        <div className="row">
          <Btn onClick={onImportJson} title="Đọc character card JSON">Nhập JSON</Btn>
          <Btn onClick={onExportJson} title="Tải character card JSON">Xuất JSON</Btn>
        </div>
      </section>
    </div>
  );
}

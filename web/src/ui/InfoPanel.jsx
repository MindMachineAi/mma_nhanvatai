/**
 * InfoPanel.jsx — Cột phải: hồ sơ nhân vật, mô tả tiếng Việt, prompt ảnh AI,
 * chỉ số RPG / giọng nói và JSON để copy.
 */
import { useState } from 'react';

const TABS = [
  { id: 'ho_so', label: 'Hồ sơ' },
  { id: 'mo_ta', label: 'Mô tả' },
  { id: 'prompt', label: 'Prompt AI' },
  { id: 'json', label: 'JSON' },
];

function KV({ k, v }) {
  if (!v) return null;
  return (
    <div className="kv">
      <span className="kv__k">{k}</span>
      <span className="kv__v">{v}</span>
    </div>
  );
}

/** Thanh chỉ số 0..20. */
function Stat({ label, value }) {
  const pct = Math.max(0, Math.min(100, ((value ?? 0) / 20) * 100));
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__bar"><i style={{ width: `${pct}%` }} /></span>
      <span className="stat__num">{value}</span>
    </div>
  );
}

export default function InfoPanel({ spec, onCopy, onSave, saved, onExportJson }) {
  const [tab, setTab] = useState('ho_so');
  const id = spec.identity ?? {};
  const p = spec.personality ?? {};
  const rpg = spec.rpg ?? {};
  const voice = spec.voice ?? {};

  return (
    <div className="info">
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'tab--on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="info__body">
        {tab === 'ho_so' && (
          <>
            <div className="row row--tight">
              <button type="button" className="btn btn--primary" onClick={onSave}>
                {saved ? '✓ Đã lưu vào thư viện' : 'Lưu vào thư viện'}
              </button>
            </div>
            <KV k="Họ tên" v={id.fullName} />
            <KV k="Tên gọi" v={id.callName} />
            <KV k="Giới tính" v={`${id.genderLabel ?? ''} · ${id.age} tuổi (${id.ageStage})`} />
            <KV k="Nghề nghiệp" v={id.occupationLabel} />
            <KV k="Quê quán" v={`${id.hometown ?? ''} — ${id.nationality ?? ''}`} />
            <KV k="Ngoại hình" v={`${spec.appearance?.heightCm} cm · ${spec.labels?.build} · tóc ${spec.labels?.hairStyle} ${spec.labels?.hairColor} · mắt ${spec.labels?.eyeColor}`} />
            <KV k="Trang phục" v={`${spec.outfit?.label} (${spec.outfit?.top} / ${spec.outfit?.bottom} / ${spec.outfit?.shoes})`} />
            <KV k="Phụ kiện" v={spec.labels?.accessory} />
            <KV k="Archetype" v={p.archetypeLabel} />
            <KV k="Câu nói" v={p.motto ? `“${p.motto}”` : ''} />
            <KV k="Thích" v={(p.likes ?? []).join(', ')} />
            <KV k="Không thích" v={(p.dislikes ?? []).join(', ')} />
            <KV k="Giọng nói" v={`${voice.ttsVoice ?? ''} · chất giọng ${voice.timbre ?? ''} · cao độ ${voice.pitch} · tốc độ ${voice.speed}`} />
            <KV k="Cấp độ" v={rpg.level ? `Cấp ${rpg.level}` : ''} />

            <h4 className="sub">Chỉ số</h4>
            <div className="stats">
              <Stat label="Sức mạnh" value={rpg.stats?.strength} />
              <Stat label="Nhanh nhẹn" value={rpg.stats?.agility} />
              <Stat label="Trí tuệ" value={rpg.stats?.intellect} />
              <Stat label="Đồng cảm" value={rpg.stats?.empathy} />
              <Stat label="Sức hút" value={rpg.stats?.charm} />
              <Stat label="Công nghệ" value={rpg.stats?.tech} />
            </div>
          </>
        )}

        {tab === 'mo_ta' && (
          <>
            {(spec.description ?? '').split('\n\n').map((para, i) => (
              <p className="para" key={`p${i}`}>{para}</p>
            ))}
            <div className="row">
              <button type="button" className="btn" onClick={() => onCopy(spec.description ?? '')}>Copy mô tả</button>
            </div>
          </>
        )}

        {tab === 'prompt' && (
          <>
            <p className="block__note">
              Prompt tiếng Anh dùng cho Gemini / MeToken / Pollinations — đổi “Phong cách ảnh” ở cột trái sẽ đổi prompt này.
            </p>
            <pre className="code">{spec.prompt}</pre>
            <div className="row">
              <button type="button" className="btn" onClick={() => onCopy(spec.prompt ?? '')}>Copy prompt</button>
            </div>
          </>
        )}

        {tab === 'json' && (
          <>
            <p className="block__note">
              Character card đầy đủ: nạp lại file này là tái tạo 100% nhân vật (cùng seed).
            </p>
            <pre className="code code--tall">{JSON.stringify(spec, null, 2)}</pre>
            <div className="row">
              <button type="button" className="btn" onClick={() => onCopy(JSON.stringify(spec, null, 2))}>Copy JSON</button>
              <button type="button" className="btn" onClick={onExportJson}>Tải .json</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

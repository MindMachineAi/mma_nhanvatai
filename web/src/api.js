/**
 * api.js — Cầu nối tới backend FastAPI (thư mục api/, cổng 8077).
 *
 * Nguyên tắc thiết kế của app: PHẦN LÕI chạy 100% offline trong trình duyệt
 * (sinh nhân vật bằng Character Engine + chân dung SVG + xem 3D bằng three.js).
 * Các hàm ở đây là "lớp nâng cấp" tuỳ chọn:
 *   - Blender headless dựng GLB có rig (dùng cho game/engine khác),
 *   - AI vẽ chân dung 2D chất lượng cao (Gemini -> MeToken -> Pollinations),
 *   - Thư viện nhân vật lưu trên server.
 * Khi server chưa bật, các hàm này ném ApiError với thông báo tiếng Việt rõ ràng.
 */

const rawBase = import.meta.env?.VITE_API_BASE || 'http://127.0.0.1:8077';
export const API_BASE = String(rawBase).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Lỗi thân thiện với người dùng cuối. */
function friendly(err) {
  if (err instanceof ApiError) return err;
  if (err?.name === 'AbortError') return new ApiError('Máy chủ phản hồi quá chậm (timeout).', 0);
  return new ApiError(
    `Không kết nối được API tại ${API_BASE}. Hãy chạy: uvicorn main:app --port 8077 (trong thư mục api/).`,
    0,
  );
}

async function requestJson(path, body, { method = 'POST', timeout = 9000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        detail = j.detail || j.message || detail;
      } catch { /* body không phải JSON */ }
      throw new ApiError(detail, res.status);
    }
    return await res.json();
  } catch (err) {
    throw friendly(err);
  } finally {
    clearTimeout(timer);
  }
}

async function requestBlob(path, body, { timeout = 300000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        detail = j.detail || detail;
      } catch { /* ignore */ }
      throw new ApiError(detail, res.status);
    }
    return await res.blob();
  } catch (err) {
    throw friendly(err);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  /** Kiểm tra server sống hay không (dùng cho đèn báo trạng thái). */
  health: () => requestJson('/health', undefined, { method: 'GET', timeout: 2500 }),

  /** Danh sách engine khả dụng (Blender có cài? có key AI nào?). */
  engines: () => requestJson('/api/engines', undefined, { method: 'GET', timeout: 4000 }),

  /** Chân dung PNG phía server (giống bản SVG trong web nhưng nét dày hơn). */
  portraitPng: (spec, size = 1024) => requestBlob('/api/portrait.png', { spec, size }, { timeout: 30000 }),

  /** Blender headless: dựng GLB có rig từ spec nhân vật. */
  glb: (spec, options = {}) => requestBlob('/api/glb', { spec, ...options }, { timeout: 300000 }),

  /** AI vẽ chân dung: trả { provider, imageUrl | imageBase64, prompt }. */
  aiPortrait: (spec, options = {}) => requestJson('/api/portrait/ai', { spec, ...options }, { timeout: 180000 }),

  /** Thư viện trên server. */
  listLibrary: () => requestJson('/api/library', undefined, { method: 'GET', timeout: 6000 }),
  saveCharacter: (spec) => requestJson('/api/library', { spec }, { timeout: 8000 }),
  deleteCharacter: (id) => requestJson(`/api/library/${encodeURIComponent(id)}`, undefined, {
    method: 'DELETE',
    timeout: 6000,
  }),
};

/** Trả về true/false thay vì ném lỗi — dùng để hiện đèn xanh/đỏ trên header. */
export async function isServerOnline() {
  try {
    await api.health();
    return true;
  } catch {
    return false;
  }
}

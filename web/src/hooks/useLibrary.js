/**
 * useLibrary.js — Thư viện nhân vật lưu NGAY TRONG TRÌNH DUYỆT (localStorage).
 *
 * Vì sao localStorage mà không phải server? Để app dùng được khi chưa bật API:
 * nhân vật vẫn được lưu, mở lại vẫn còn. Khi bật API thì có thêm lớp lưu trên
 * server (api.saveCharacter) — xem App.jsx.
 */
import { useCallback, useEffect, useState } from 'react';
import { slugify, normalizeSpec } from '../engine/characterEngine.js';

const KEY = 'nhanvatai.library.v1';
const MAX_ITEMS = 200;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch (err) {
    // Hết dung lượng -> bỏ qua, không làm sập UI
    console.warn('[thư viện] không ghi được localStorage:', err?.message);
  }
}

/** Bản gọn để lưu: giữ spec đầy đủ (nhờ vậy mở lại tái tạo được 100%). */
function slim(spec) {
  return { ...spec, description: undefined, threeD: undefined, prompt: undefined, labels: undefined };
}

export function useLibrary() {
  const [items, setItems] = useState(() => read());

  useEffect(() => { write(items); }, [items]);

  /** Thêm/cập nhật theo id. Trả về id đã lưu. */
  const save = useCallback((spec) => {
    const record = { ...slim(normalizeSpec(spec)), savedAt: new Date().toISOString() };
    setItems((prev) => [record, ...prev.filter((x) => x.id !== record.id)].slice(0, MAX_ITEMS));
    return record.id;
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const has = useCallback((id) => items.some((x) => x.id === id), [items]);

  /** Xuất toàn bộ thư viện ra file JSON. */
  const toJson = useCallback(() => JSON.stringify({ app: 'MMA NhanVatAI', kind: 'library', items }, null, 2), [items]);

  /** Nhập file JSON (1 nhân vật hoặc cả thư viện) -> trả về số bản ghi đã thêm. */
  const importJson = useCallback((text) => {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [data];
    const records = list.map((x) => {
      const spec = normalizeSpec(x);
      return { ...slim(spec), savedAt: new Date().toISOString() };
    });
    setItems((prev) => [...records, ...prev.filter((p) => !records.some((r) => r.id === p.id))].slice(0, MAX_ITEMS));
    return records.length;
  }, []);

  return { items, save, remove, clear, has, toJson, importJson, filename: 'thu-vien-nhan-vat.json', slugify };
}

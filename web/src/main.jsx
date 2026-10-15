/**
 * main.jsx — Điểm khởi động của web creator.
 *
 * Lưu ý: KHÔNG bọc <StrictMode> để tránh việc React gọi effect 2 lần ở chế độ dev
 * (sẽ tạo 2 WebGL context cho viewer 3D rồi phải giải phóng).
 */
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

const host = document.getElementById('root');
createRoot(host).render(<App />);

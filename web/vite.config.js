import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cấu hình Vite cho web creator (giống convention các dự án khác của anh)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});

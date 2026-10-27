import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Bản demo tĩnh cho GitHub Pages: chế độ `demo` bật mock API trong trình
// duyệt (xem web/.env.demo) và đặt base theo tên repository.
export default defineConfig(({ mode }) => {
  const demoMode = mode === 'demo';

  return {
    base: demoMode ? '/XeGo/' : '/',
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:4000', changeOrigin: true },
        '/socket.io': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});

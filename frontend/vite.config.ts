import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Docker mounts node_modules as a read-only dependency volume. Keep Vite's
  // optimizer cache in the writable source mount instead.
  cacheDir: process.env.VITE_CACHE_DIR ?? '.vite-cache',
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Required for reliable hot reload when sources are bind-mounted on
    // Windows / Docker Desktop. Set VITE_POLLING=false to disable locally.
    watch: { usePolling: process.env.VITE_POLLING !== 'false', interval: 500 },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});

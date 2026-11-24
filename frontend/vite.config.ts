import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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

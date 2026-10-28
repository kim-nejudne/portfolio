import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { DEFAULT_PORT } from './shared/constants.js';

const server = `http://localhost:${DEFAULT_PORT}`;

export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': server,
      '/healthz': server,
      '/socket.io': { target: server, ws: true },
    },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist/client', import.meta.url)),
    emptyOutDir: true,
  },
  test: {
    root: fileURLToPath(new URL('.', import.meta.url)),
    include: ['{client,server,shared}/**/*.test.{ts,tsx}'],
    environment: 'node',
    // Vitest blanks CSS by default; let `?raw` imports through (the favicon test reads the theme tokens).
    css: { include: [/\.css\?raw$/] },
  },
});

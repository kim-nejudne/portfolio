import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { DEFAULT_PORT, DEV_CLIENT_PORT } from './shared/constants.js';

const server = `http://localhost:${DEFAULT_PORT}`;

export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: {
    // Phones on the same Wi-Fi open the dev client directly (`npm run lan`).
    host: '0.0.0.0',
    port: DEV_CLIENT_PORT,
    strictPort: true,
    proxy: {
      // The admin's write guard (F80) needs Origin to match Host, so its Host passes through
      // unchanged (as in Buzzr). It must come before `/api`: the first matching key wins.
      '/api/admin': { target: server, changeOrigin: false },
      '/api': server,
      '/healthz': server,
      // Both namespaces (`/` and `/ink`) share this one WebSocket path.
      '/socket.io': { target: server, ws: true },
    },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist/client', import.meta.url)),
    emptyOutDir: true,
  },
  test: {
    root: fileURLToPath(new URL('.', import.meta.url)),
    include: ['{client,server,shared,scripts}/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});

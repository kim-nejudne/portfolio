import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { DEV_CLIENT_PORT, DEV_SERVER_PORT } from './shared/constants.js';

const server = `http://localhost:${DEV_SERVER_PORT}`;

export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: {
    // Phones on the same Wi-Fi can open the dev client directly.
    host: '0.0.0.0',
    port: DEV_CLIENT_PORT,
    strictPort: true,
    proxy: {
      // The admin's same-origin write guard needs Host to pass through unchanged (as in Buzzr).
      // It must come before `/api`: the first matching key wins.
      '/api/admin': { target: server, changeOrigin: false },
      '/api': server,
      '/healthz': server,
      '/dev': server,
      '/tiles': server,
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

// Vite config for the app (spec §2 Build). MDX, the twoslash transformer and the PWA plugin
// join at F6 and F15; `pnpm build` runs scripts/copy-ts-libs.ts before this.
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

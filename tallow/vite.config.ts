import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

// Vite only builds the client bundle. In development it runs in middleware mode
// inside the Express server (see server.ts) so the API and the app share one
// origin and one port; in production Express serves the built dist/ directly.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Fonts are small and few; inlining them as data URIs would bloat the CSS
    // and delay first paint behind the whole family set.
    assetsInlineLimit: 0,
  },
});

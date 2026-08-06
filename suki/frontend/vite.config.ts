import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    /**
     * The service worker is what makes "offline-first" true on a *cold* start.
     *
     * Without it, the queue in IndexedDB is intact and useless: a phone with no
     * signal opening the app gets nothing to render it with. Precaching the
     * shell is the difference between an app that survives having no connection
     * and one that only survives losing it — and in a sari-sari store the
     * former is the normal case, not the edge case.
     */
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'SUKI — sari-sari ledger',
        short_name: 'SUKI',
        description: 'Lista, tingi stock and the day’s takings for a sari-sari store.',
        lang: 'en-PH',
        // A phone in one hand behind a counter. Never a desktop window.
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FBF8F0',
        theme_color: '#FBF8F0',
        /**
         * The shop, not the front door. `/` is now a public landing page for
         * whoever arrives cold; an installed app belongs to the shopkeeper,
         * and she wants the till. It bounces to `/unlock` while locked, which
         * is the right first screen for someone who already knows what this is.
         *
         * `scope` stays `/` so the landing page is inside the service worker's
         * control and gets precached with everything else.
         */
        start_url: '/till',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        /**
         * The API is never cached, and the SPA fallback must never answer for
         * it. A cached push response would tell a shopkeeper her sales synced
         * when they did not — the one lie this app cannot afford, because the
         * pending badge is the only thing standing between her and assuming
         * the day's takings are safe.
         */
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
        // Self-hosted variable fonts are large and precached in full; the
        // default 2MB per-file ceiling silently drops them from the manifest.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        // Off in dev: a service worker serving a stale shell during HMR looks
        // exactly like a broken build.
        enabled: false,
      },
    }),
  ],
  server: {
    port: 3000,
    strictPort: true,
    // The scaffold pinned HMR to clientPort 443 over wss and allowed every
    // host — settings for the builder's preview proxy that break the dev
    // server anywhere else.
  },
  preview: {
    port: 3000,
  },
});

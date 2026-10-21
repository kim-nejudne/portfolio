// Vite config for the app (spec §2 Build): the content plugins (content/ validated with Zod,
// MDX compiled with the twoslash and shiki pipeline, all at build time), React, Tailwind and the
// service worker (§9 Offline); `pnpm build` runs scripts/copy-ts-libs.ts before this.
//
// `--mode e2e` builds the fixture course in fixtures/content/ into dist-e2e/ instead, for the
// Playwright suite (src/content/node/roots.ts); `pnpm build` and deploy.sh never see it.
//
// The content plugin lives in src/ and imports the app's modules through the `@/` alias, which
// Vite's config bundler cannot resolve (it bundles the config with its relative imports and
// leaves everything else to Node). It is loaded through tsx's `tsImport`, which applies
// tsconfig's `paths` at run time, the same loader `pnpm content:lint` runs under.
//
// `vite preview` sends the §10 Content-Security-Policy read from deploy/nginx/ts-dojo.conf, so
// every Playwright run happens under exactly the policy nginx ships. The dev server does not:
// Vite's HMR client needs an inline script.
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { tsImport } from 'tsx/esm/api';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { documentCsp } from './deploy/nginx-conf.ts';

const { tsDojoContent } = (await tsImport(
  './src/content/node/vite-plugin.ts',
  import.meta.url,
)) as typeof import('./src/content/node/vite-plugin');
const { contentDirFor, outDirFor } = (await tsImport(
  './src/content/node/roots.ts',
  import.meta.url,
)) as typeof import('./src/content/node/roots');

/** Workbox skips larger files with only a warning; the ts-ls chunk is 3.6 MB, lib.dom.d.ts 2.4 MB. */
const PRECACHE_FILE_LIMIT = 8 * 1024 * 1024;

export default defineConfig(({ mode }) => ({
  plugins: [
    ...tsDojoContent({ contentDir: contentDirFor(mode) }),
    react(),
    tailwindcss(),
    // §9 Offline: generateSW precaches the app, both worker chunks and public/ts/6.0.3/**. Prompt
    // mode: a new version waits for Reload (src/app/update.ts registers it, so nothing is
    // injected into index.html).
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      includeManifestIcons: false,
      manifest: {
        name: 'ts-dojo',
        short_name: 'ts-dojo',
        description:
          'TypeScript from the first annotation to type-level programming, in a Vim REPL.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#111827',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // The manifest is added by the plugin itself; the icon is the favicon, matched here.
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'ts/6.0.3/**'],
        maximumFileSizeToCacheInBytes: PRECACHE_FILE_LIMIT,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/assets\//, /^\/ts\//],
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: outDirFor(mode),
    // Never inline a font: the §10 CSP's `font-src 'self'` blocks a `data:` font, and Vite would
    // inline a woff2 subset under 4 KB (JetBrains Mono's cyrillic-ext) into the CSS.
    assetsInlineLimit: (filePath) =>
      filePath.endsWith('.woff2') ? false : undefined,
  },
  preview: {
    headers: { 'Content-Security-Policy': documentCsp() },
  },
}));

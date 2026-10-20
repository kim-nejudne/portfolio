// Vite config for the app (spec §2 Build): the content plugins (content/ validated with Zod,
// MDX compiled with the twoslash and shiki pipeline, all at build time), React and Tailwind.
// The PWA plugin joins at F15; `pnpm build` runs scripts/copy-ts-libs.ts before this.
//
// The content plugin lives in src/ and imports the app's modules through the `@/` alias, which
// Vite's config bundler cannot resolve (it bundles the config with its relative imports and
// leaves everything else to Node). It is loaded through tsx's `tsImport`, which applies
// tsconfig's `paths` at run time, the same loader `pnpm content:lint` runs under.
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { tsImport } from 'tsx/esm/api';
import { defineConfig } from 'vite';

const { tsDojoContent } = (await tsImport(
  './src/content/node/vite-plugin.ts',
  import.meta.url,
)) as typeof import('./src/content/node/vite-plugin');

export default defineConfig({
  plugins: [...tsDojoContent(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

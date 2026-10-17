// Unit tests run in Node: the pure modules under src/ and the scripts (spec §2: both worker
// cores are pure so Vitest and the content lint run them without a browser). e2e/ belongs to
// Playwright and is left out on purpose. Own config so unit tests never load the Vite plugins.
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    // `pnpm bench` (vitest bench): the §12 F2 diagnostics benchmark on the ts-ls core.
    benchmark: {
      include: ['src/**/*.bench.ts'],
    },
  },
});

import { defineConfig } from 'vitest/config';

/**
 * Separate from `vite.config.ts` on purpose: the app config carries the PWA
 * plugin, and generating a service worker for a unit-test run is both slow and
 * irrelevant.
 */
export default defineConfig({
  test: {
    environment: 'node',
    // `fake-indexeddb/auto` installs a real IndexedDB implementation on
    // globalThis, so Dexie is exercised rather than mocked. A mocked Dexie
    // would prove the queue calls the functions it calls, which is not the
    // question — the question is whether a write survives a restart.
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});

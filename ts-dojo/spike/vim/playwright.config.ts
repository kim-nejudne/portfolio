// Runs the Prep Vim checklist (checklist.spec.ts) against the spike page in Kim's installed
// Google Chrome (channel 'chrome'), headless, with the clipboard permissions the `"+` register needs.
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const PORT = 5179;

export default defineConfig({
  testDir: '.',
  testMatch: /checklist\.spec\.ts$/,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  timeout: 20_000,
  expect: { timeout: 3_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    viewport: { width: 1200, height: 800 },
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
  ],
  webServer: {
    command: 'pnpm spike:vim',
    cwd: path.resolve(import.meta.dirname, '..', '..'),
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});

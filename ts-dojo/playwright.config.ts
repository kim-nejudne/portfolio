// Playwright for e2e/ (spec §12): drives a fresh production build through `vite preview` on
// port 4173, in Kim's installed Google Chrome (channel 'chrome'; Playwright 1.64.1's own
// Chromium is not in the cache), headless, with the clipboard permissions the `"+` register
// needs. Build-then-preview is Kim's online-voting convention and what F15 needs for the
// service worker and the CSP; a preview already listening on 4173 is reused outside CI.
// The Prep spike keeps its own config under spike/vim/.
import { defineConfig } from '@playwright/test';

const PORT = 4173;
const CI = process.env.CI !== undefined && process.env.CI !== '';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: 0,
  reporter: CI ? 'github' : 'list',
  timeout: 20_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    viewport: { width: 1280, height: 800 },
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});

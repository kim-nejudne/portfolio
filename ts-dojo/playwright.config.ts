// Playwright for e2e/ (spec §12): drives a fresh production build through `vite preview` on
// port 4173, in Kim's installed Google Chrome (channel 'chrome'; Playwright 1.64.1's own
// Chromium is not in the cache), headless, with the clipboard permissions the `"+` register
// needs. Build-then-preview is Kim's online-voting convention and what F15 needs for the
// service worker and the CSP; a preview already listening on 4173 is reused outside CI.
// The Prep spike keeps its own config under spike/vim/.
//
// F11: the suite runs against the fixture course (fixtures/content/, built with `--mode e2e`
// into dist-e2e/), whose lessons were made to exercise the app; the course in content/ is
// built into dist/ first, for the course spec and the §9 budgets, which serve it themselves.
// The two builds run one after the other, so their copy-ts-libs steps never race.
//
// F15: service workers are blocked unless a spec allows them. The suite's assertions about the
// app's own requests (the lib fetches, the held worker chunk) are about the page, and the
// precache would otherwise download the whole app into every context. The offline, update and
// CSP specs allow them. The §9 budgets are their own project, run on demand and alone
// (`pnpm test:e2e --project budgets`), never under the main suite's CPU load.
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
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chrome',
      use: { browserName: 'chromium', channel: 'chrome' },
      testIgnore: /budgets\.spec\.ts$/,
    },
    {
      name: 'budgets',
      use: { browserName: 'chromium', channel: 'chrome' },
      testMatch: /budgets\.spec\.ts$/,
      fullyParallel: false,
      default: false,
    },
  ],
  webServer: {
    command: `pnpm build && pnpm build --mode e2e && pnpm preview --mode e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});

// The end-to-end smoke game (`npm run e2e`, which builds first). Playwright's runner comes with the
// `playwright` package already used by the playtest harness, so there is no @playwright/test.
import { existsSync } from 'node:fs';
import { chromium, defineConfig } from 'playwright/test';

const PORT = 3019;
// CHROMIUM names a system browser; without Playwright's own download, /usr/bin/chromium is tried.
const executablePath =
  process.env.CHROMIUM ??
  (!existsSync(chromium.executablePath()) && existsSync('/usr/bin/chromium')
    ? '/usr/bin/chromium'
    : undefined);

export default defineConfig({
  testDir: 'e2e',
  timeout: 5 * 60_000,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    launchOptions: { executablePath },
    actionTimeout: 30_000,
    trace: 'retain-on-failure',
  },
  webServer: {
    // The built server outside production: the dev fixture ("World (dev)") from an empty data dir,
    // the fake generator, and no keys, so nothing leaves the machine.
    command: 'rm -rf .playtest/e2e-data && node --conditions=dist dist/server/index.js',
    url: `http://localhost:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      NODE_ENV: 'development',
      PORT: String(PORT),
      DATA_DIR: '.playtest/e2e-data',
      GENERATE_FAKE: '1',
      PINPOINT_ANTHROPIC_API_KEY: '',
      PINPOINT_CARTO_KEY: '',
      WIKIMEDIA_CONTACT: '',
      ADMIN_PASSWORD_HASH: '',
    },
  },
});

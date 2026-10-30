// Playwright harness for playtests: one isolated browser context per role (a Screen and several
// phones), so each has its own localStorage, cookies and socket, as on real devices.
// Scenarios export a default `(h: Harness) => Promise<void>` and run with
// `npm run playtest -- <scenario.ts>` (see run.ts). Assert on page text; screenshot only failures
// and visual checks.
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  chromium,
  devices,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from 'playwright';

/** Viewports the spec cares about. Phones are emulated in Chromium (touch, mobile viewport, DPR). */
export const DEVICES = {
  /** A laptop on a TV. */
  tv: { viewport: { width: 1920, height: 1080 } },
  /** A tablet held sideways as the Screen. */
  tablet: { viewport: { width: 1180, height: 820 }, hasTouch: true },
  'Pixel 7': devices['Pixel 7'],
  'iPhone 13': devices['iPhone 13'],
  /** The smallest phone the pads must fit. */
  'small phone': { viewport: { width: 360, height: 560 }, isMobile: true, hasTouch: true },
} satisfies Record<string, BrowserContextOptions>;

export type DeviceName = keyof typeof DEVICES;

export interface Role {
  name: string;
  context: BrowserContext;
  page: Page;
  /** Console errors and uncaught page errors, verbatim. */
  errors: string[];
  /** Saves `<outDir>/<step>-<role>.png` and returns its path. */
  screenshot(step: string): Promise<string>;
}

export interface Harness {
  /** The dev client, `http://localhost:5173` unless `PLAYTEST_URL` says otherwise. */
  baseUrl: string;
  /** Where screenshots go. */
  outDir: string;
  /**
   * Opens a fresh, isolated context for a role and navigates it to `path`. A Screen's "Tap to
   * start" (F37) is tapped whenever it would block an action, unless `keepStart` is set.
   */
  openRole(
    name: string,
    device: DeviceName,
    path?: string,
    options?: { keepStart?: boolean },
  ): Promise<Role>;
  roles: Map<string, Role>;
  /** Deduplicated console errors per role. */
  consoleErrors(): Record<string, string[]>;
  closeAll(): Promise<void>;
}

const FALLBACK_CHROMIUM = '/usr/bin/chromium';

async function launchBrowser(): Promise<Browser> {
  const headless = process.env.HEADED !== '1';
  // CHROMIUM points at a system browser, for machines without Playwright's own download.
  if (process.env.CHROMIUM)
    return chromium.launch({ headless, executablePath: process.env.CHROMIUM });
  try {
    return await chromium.launch({ headless });
  } catch (err) {
    if (!existsSync(FALLBACK_CHROMIUM)) throw err;
    return chromium.launch({ headless, executablePath: FALLBACK_CHROMIUM });
  }
}

export async function launch({
  baseUrl = process.env.PLAYTEST_URL ?? 'http://localhost:5173',
  outDir = '.playtest/scratch',
}: { baseUrl?: string; outDir?: string } = {}): Promise<Harness> {
  const browser = await launchBrowser();
  const roles = new Map<string, Role>();

  async function openRole(
    name: string,
    device: DeviceName,
    path = '/',
    { keepStart = false }: { keepStart?: boolean } = {},
  ): Promise<Role> {
    if (roles.has(name)) throw new Error(`Role "${name}" is already open.`);
    // Phone descriptors name WebKit for iPhones; everything runs in Chromium here.
    const options: BrowserContextOptions & { defaultBrowserType?: string } = { ...DEVICES[device] };
    delete options.defaultBrowserType;
    const context = await browser.newContext({ ...options, baseURL: baseUrl });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    const role: Role = {
      name,
      context,
      page,
      errors,
      async screenshot(step) {
        await mkdir(outDir, { recursive: true });
        const file = join(outDir, `${step}-${name}.png`);
        await page.screenshot({ path: file });
        return file;
      },
    };
    roles.set(name, role);
    // A Screen opens under "Tap to start" (F37): scenarios that act on it get past it the way a
    // person would.
    if (!keepStart) {
      await page.addLocatorHandler(
        page.getByRole('button', { name: /^(Tap|Click) to start/ }),
        (button) => button.click(),
      );
    }
    await page.goto(path);
    return role;
  }

  return {
    baseUrl,
    outDir,
    openRole,
    roles,
    consoleErrors() {
      return Object.fromEntries(
        [...roles].map(([name, role]) => [name, [...new Set(role.errors)]]),
      );
    },
    async closeAll() {
      for (const role of roles.values()) await role.context.close();
      roles.clear();
      await browser.close();
    },
  };
}

/** Waits until `text` is visible on the page, or fails with the role's name. */
export async function expectText(role: Role, text: string | RegExp, timeout = 5000): Promise<void> {
  try {
    await role.page.getByText(text).first().waitFor({ state: 'visible', timeout });
  } catch {
    throw new Error(`${role.name}: expected to see ${String(text)}`);
  }
}

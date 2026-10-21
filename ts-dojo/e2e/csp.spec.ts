// §12 F15: "The CSP in §10 is present and nothing in the app is blocked by it (no CSP errors in
// the Playwright console)."
//
// Present: the suite's `vite preview` sends the policy it reads from deploy/nginx/ts-dojo.conf
// (vite.config.ts), so the document, a lesson URL and the worker chunk must carry §10's string
// verbatim; deploy/deploy.test.ts proves every nginx location sends the same.
//
// Nothing blocked: a walk through every page and every flow that touches what the policy
// governs (workers, blob-URL modules, the lib fetches, inline styles, fonts, downloads, the
// service worker), on a private server that also sends the policy as Report-Only with a
// report-uri (e2e/helpers/preview-server.ts). Three listeners must stay empty: the console of
// the page, its workers and the service worker (CSP or "Refused to" in the text); the page's
// `securitypolicyviolation` events; and the reports, which also come from inside workers, where
// the console Playwright sees drops the browser's own messages. Two canaries prove the listeners
// work rather than trusting their silence: the sandbox's `new Function` is blocked and reported
// from the worker, and a cross-origin fetch from the page is blocked and reported; a last canary
// flushes the reports before the assertion.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { codeBlocks, gotoLesson } from './helpers/content';
import {
  consoleEntries,
  ex,
  gotoRepl,
  problems,
  runStatus,
  setDoc,
  SETTINGS_KEY,
  waitForCompilerReady,
} from './helpers/editor';
import { gotoProgress } from './helpers/progress';
import {
  E2E_DIST,
  startDistServer,
  type CspReport,
  type DistServer,
} from './helpers/preview-server';
import {
  applyImport,
  chooseImportFile,
  exportFromProgress,
  gotoSettings,
} from './helpers/settings';
import { gotoExercise, runTest } from './helpers/verify';

/** §10, verbatim. */
const SPEC_CSP =
  "default-src 'self'; script-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'";

test.describe('the §10 CSP is present', () => {
  test('the document, a lesson URL and the worker chunk carry the §10 policy verbatim', async ({
    page,
  }) => {
    const workerChunks: string[] = [];
    page.on('response', (response) => {
      if (/\/assets\/worker-[^/]+\.js$/.test(response.url())) {
        workerChunks.push(
          response.headers()['content-security-policy'] ?? '<none>',
        );
      }
    });
    const document = await page.goto('/');
    expect(document?.headers()['content-security-policy']).toBe(SPEC_CSP);
    await waitForCompilerReady(page);
    expect(workerChunks).toEqual([SPEC_CSP]);

    const lesson = await page.goto('/l/m99-fixtures/01-fix');
    expect(lesson?.headers()['content-security-policy']).toBe(SPEC_CSP);
  });

  test('the built CSS has no data: fonts, which font-src would block', () => {
    const assets = path.join(E2E_DIST, 'assets');
    const css = readdirSync(assets).filter((name) => name.endsWith('.css'));
    expect(css.length).toBeGreaterThan(0);
    for (const name of css) {
      const text = readFileSync(path.join(assets, name), 'utf8');
      expect(text, name).not.toMatch(/url\(\s*["']?data:(font|application)/);
      expect(text, name).toMatch(/url\(\/assets\/[^)]+\.woff2\)/);
    }
  });
});

interface PageViolation {
  directive: string;
  blocked: string;
  source: string;
}

declare global {
  interface Window {
    __cspViolation?: (violation: PageViolation) => Promise<void>;
  }
}

/** Every CSP complaint the console shows, from the page, its workers and the service worker. */
function recordConsole(context: BrowserContext): string[] {
  const found: string[] = [];
  const csp = /content.security.policy|refused to/i;
  context.on('console', (message) => {
    if (csp.test(message.text())) {
      const from = message.worker()?.url() ?? 'page';
      found.push(`${message.type()} [${from}]: ${message.text()}`);
    }
  });
  context.on('weberror', (error) => {
    if (csp.test(String(error.error()))) found.push(String(error.error()));
  });
  return found;
}

/** The sandbox canary: an eval from a blob-URL module, reported from the sandbox worker. */
const isSandboxCanary = (report: CspReport): boolean =>
  report['blocked-uri'] === 'eval' &&
  report['source-file'] === 'blob' &&
  /\/assets\/worker-[^/]+\.js$/.test(report['document-uri'] ?? '');

const isCanary = (report: CspReport): boolean =>
  (report['blocked-uri'] ?? '').includes('csp-canary') ||
  isSandboxCanary(report);

async function expectReport(
  server: DistServer,
  match: (report: CspReport) => boolean,
  what: string,
): Promise<void> {
  // Chrome sends a report-uri report on its own schedule, later still from a worker under the
  // full suite's load: one F11 run waited longer than 10 s for the sandbox's. The walk's own
  // timeout is 120 s.
  await expect
    .poll(() => server.reports().filter(match).length, {
      message: `${what}; reports so far:\n${JSON.stringify(server.reports(), null, 2)}`,
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
}

/** Blocked by connect-src; the report names the host, so each canary is told apart. */
async function pageCanary(page: Page, name: string): Promise<void> {
  await page.evaluate(async (url) => {
    await fetch(url).catch(() => undefined);
  }, `https://csp-canary-${name}.invalid/`);
}

test.describe('nothing in the app is blocked by the §10 CSP', () => {
  test.use({ serviceWorkers: 'allow' });

  let server: DistServer;
  test.beforeAll(async () => {
    server = await startDistServer({ reportCsp: true });
  });
  test.afterAll(async () => {
    await server.close();
  });

  test('every page and flow, with the service worker installed, raises no violation', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      baseURL: server.url,
      serviceWorkers: 'allow',
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const consoleErrors = recordConsole(context);
    // Each event goes to the test as it happens: a navigation would drop a list kept in the page.
    const seen: PageViolation[] = [];
    await context.exposeFunction('__cspViolation', (v: PageViolation) => {
      seen.push(v);
    });
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        void window.__cspViolation?.({
          directive: event.effectiveDirective,
          blocked: event.blockedURI,
          source: event.sourceFile,
        });
      });
    });
    const page = await context.newPage();

    // Roadmap: the shell, the compiler worker and its lib fetches, then the service worker,
    // which registers once the compiler is ready and precaches the app and /ts/6.0.3/.
    await page.goto('/');
    await waitForCompilerReady(page);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active === null) throw new Error('no active worker');
    });

    // The canaries: the listeners must hear a real violation from the page and from a worker.
    await pageCanary(page, 'page');
    await expectReport(
      server,
      (r) => (r['blocked-uri'] ?? '').includes('csp-canary-page'),
      'the page canary is reported',
    );
    // Once enforced, once report-only.
    await expect
      .poll(
        () => seen.filter((v) => v.blocked.includes('csp-canary-page')).length,
        { message: 'the page canary fired securitypolicyviolation' },
      )
      .toBe(2);
    await gotoRepl(page);
    await waitForCompilerReady(page);
    await setDoc(
      page,
      [
        'try {',
        "  new Function('return 1')();",
        "  console.log('eval allowed');",
        '} catch {',
        "  console.log('eval blocked');",
        '}',
        '',
      ].join('\n'),
      { line: 1, col: 0 },
    );
    await ex(page, 'w');
    await expect(runStatus(page)).toContainText('done in');
    await expect(consoleEntries(page)).toHaveText([/^eval blocked/]);
    await expectReport(
      server,
      isSandboxCanary,
      "the sandbox's new Function is reported from inside the worker",
    );
    // The console heard the page canary too. Its lines name the canary's host and are the only
    // ones left out at the end; the record is never cleared. (Chrome's own message about the
    // sandbox's eval stays in the worker, which is why the reports are listened to as well.)
    expect(
      consoleErrors.some((line) => line.includes('csp-canary-page')),
      `the page canary reached the console:\n${consoleErrors.join('\n')}`,
    ).toBe(true);

    // /repl: a run with output, on the welcome buffer.
    await setDoc(page, "console.log('hello', 1 + 1);\n", { line: 1, col: 0 });
    await ex(page, 'w');
    await expect(runStatus(page)).toContainText('done in');
    await expect(consoleEntries(page)).toHaveText([/^hello 2/]);

    // The DOM lib on first use: compiler defaults with `dom`, then a DOM type in /repl.
    await page.evaluate((key) => {
      localStorage.setItem(
        key,
        JSON.stringify({ compilerDefaults: { lib: ['es2025', 'dom'] } }),
      );
    }, SETTINGS_KEY);
    await gotoRepl(page);
    await waitForCompilerReady(page);
    await setDoc(page, 'const el: HTMLElement = 1;\n', { line: 1, col: 0 });
    await expect(problems(page).first()).toContainText(
      "Type 'number' is not assignable to type 'HTMLElement'.",
    );
    await page.evaluate((key) => localStorage.removeItem(key), SETTINGS_KEY);

    // Module page, lesson theory (twoslash output, fonts, shiki's inline styles) and theory Run.
    await page.goto('/m/m99-fixtures');
    await expect(page.getByRole('main')).toContainText(
      'Fixing an exhaustiveness error',
    );
    await gotoLesson(page, '01-fix');
    await expect(codeBlocks(page, 'twoslash').first()).toBeVisible();
    const block = codeBlocks(page, 'run').first();
    const run = block.getByRole('button', { name: 'Run', exact: true });
    await run.focus();
    await page.keyboard.press('Enter');
    await expect(
      block.getByRole('region', { name: 'Output' }).getByRole('status'),
    ).toHaveText(/^done in \d+ ms$/);

    // An exercise: :run and :test (blob-URL modules in a fresh sandbox worker, both modes).
    await gotoExercise(page, '01-fix', '01-handle-the-new-shape');
    await ex(page, 'run');
    await expect(runStatus(page)).toHaveText(/^(done in|failed:)/);
    await page.locator('.cm-content').focus();
    await runTest(page);

    // Settings, progress export (a blob: download) and import (a file read).
    await gotoSettings(page);
    await gotoProgress(page);
    const exported = await exportFromProgress(page);
    await chooseImportFile(page, exported.name, exported.json);
    await applyImport(page, exported.name);

    // The palette and the help overlay (dialogs, focus traps, inline styles).
    await page.goto('/');
    await expect(page.getByRole('main')).toBeVisible();
    await page.keyboard.press('Control+p');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    // Flush: once this canary's report is in, any earlier report is too.
    await pageCanary(page, 'flush');
    await expectReport(
      server,
      (r) => (r['blocked-uri'] ?? '').includes('csp-canary-flush'),
      'the flush canary is reported',
    );

    expect(
      seen.filter((v) => !v.blocked.includes('csp-canary')),
      'securitypolicyviolation events',
    ).toEqual([]);
    expect(
      consoleErrors.filter((line) => !line.includes('csp-canary')),
      'CSP messages in the console',
    ).toEqual([]);
    expect(
      server.reports().filter((r) => !isCanary(r)),
      'CSP reports',
    ).toEqual([]);
    await context.close();
  });
});

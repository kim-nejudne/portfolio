// §12 F2: "The worker reports `ready` with `tsVersion` `6.0.3`, and no request leaves the
// origin (Playwright network log)." main.tsx starts the ts-ls Worker before the first render on
// every route (§2, §9 Warm-up); the worker answers `init` with `ready { tsVersion }` once its
// empty default project is open, and the header chip (role status, name "compiler status")
// reads "compiler loading" until then, "TypeScript <tsVersion>" with data-state="ready" after.
// Every request the page and its workers make is recorded from before the navigation until
// the network is idle after ready, and each must have the page's origin: the worker's own code
// comes from /assets/worker-<hash>.js and the warm-up fetches exactly the 76-file
// `/// <reference lib>` chain of lib.es2025.d.ts from /ts/6.0.3/ (74 lib.es*.d.ts plus the two
// decorators files), each once and nothing from dom, webworker or scripthost (§9: "DOM loads on
// first use"). The chain is walked on disk here, independently of the worker's loader. No
// fixed waits: the ready wait is a 15 s expect because the compiler chunk is 3.5 MB and a cold
// worker takes a few seconds; the chip is not required to be caught reading "compiler loading".
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const TS_VERSION = '6.0.3';
const LIB_BASE = `/ts/${TS_VERSION}/`;
const LIB_CHAIN_LENGTH = 76;
const WORKER_CHUNK = /^\/assets\/worker-[^/]+\.js$/;
const LIB_REFERENCE = /\/\/\/\s*<reference\s+lib="([^"]+)"\s*\/>/g;
/** Where `pnpm build` copies the lib files (scripts/copy-ts-libs.ts); `vite preview` serves it under LIB_BASE. */
const LIB_DIR = fileURLToPath(new URL(`../public${LIB_BASE}`, import.meta.url));

/** The `/// <reference lib>` chain of `start` on disk, sorted. Read inside a test: public/ts/ exists only after the build. */
function chainOnDisk(start: string): string[] {
  const seen = new Set<string>();
  const stack = [start];
  for (let name = stack.pop(); name !== undefined; name = stack.pop()) {
    if (seen.has(name)) continue;
    seen.add(name);
    const text = readFileSync(path.join(LIB_DIR, name), 'utf8');
    for (const [, lib] of text.matchAll(LIB_REFERENCE)) {
      if (lib !== undefined) stack.push(`lib.${lib}.d.ts`);
    }
  }
  return [...seen].sort();
}

/** Every URL the page (and its dedicated workers) requests from now on, in order. */
function recordRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    urls.push(request.url());
  });
  return urls;
}

/** The worker's `ready` reply, seen through the chip, then the network settling after it. */
async function waitForCompilerReady(page: Page): Promise<void> {
  const chip = page.getByRole('status', { name: 'compiler status' });
  await expect(chip).toHaveText(`TypeScript ${TS_VERSION}`, {
    timeout: 15_000,
  });
  await expect(chip).toHaveAttribute('data-state', 'ready');
  await page.waitForLoadState('networkidle');
}

/** Fails with the full list of offenders if any recorded URL has another origin than the page. */
function expectSameOrigin(page: Page, urls: readonly string[]): void {
  const origin = new URL(page.url()).origin;
  const offenders = urls.filter((url) => new URL(url).origin !== origin);
  expect(
    offenders,
    `requests that left ${origin}:\n${offenders.join('\n')}`,
  ).toEqual([]);
}

/** The pathnames of the recorded URLs. */
function pathnames(urls: readonly string[]): string[] {
  return urls.map((url) => new URL(url).pathname);
}

test('§12 F2: the worker reports ready with tsVersion 6.0.3, and no request leaves the origin', async ({
  page,
}) => {
  const urls = recordRequests(page);
  await page.goto('/');
  await waitForCompilerReady(page);

  expectSameOrigin(page, urls);
  const paths = pathnames(urls);
  expect(
    paths.filter((p) => WORKER_CHUNK.test(p)),
    'the ts-ls worker chunk, requested once',
  ).toHaveLength(1);

  // The warm-up's lib fetches: the es2025 chain, each file once, from this version's directory.
  const compilerFiles = paths.filter((p) => p.startsWith('/ts/'));
  expect(
    compilerFiles.filter((p) => !p.startsWith(LIB_BASE)),
    `compiler files requested outside ${LIB_BASE}`,
  ).toEqual([]);
  const libs = compilerFiles.map((p) => p.slice(LIB_BASE.length));
  const distinct = [...new Set(libs)].sort();
  expect(
    libs.filter((name, index) => libs.indexOf(name) !== index),
    'lib files fetched more than once',
  ).toEqual([]);
  expect(distinct).toEqual(
    expect.arrayContaining([
      'lib.es2025.d.ts',
      'lib.es5.d.ts',
      'lib.decorators.d.ts',
      'lib.decorators.legacy.d.ts',
    ]),
  );
  expect(
    distinct.filter((name) => /dom|webworker|scripthost/.test(name)),
    'libs that must wait for first use',
  ).toEqual([]);
  expect(distinct, 'the lib.es2025.d.ts reference chain').toHaveLength(
    LIB_CHAIN_LENGTH,
  );
  expect(distinct).toEqual(chainOnDisk('lib.es2025.d.ts'));
});

// The worker starts on every route, not only the roadmap: a direct load of /repl and of a
// nested lesson path (where a relative worker or lib URL would resolve under /l/m03-unions/
// and 404) reaches the same ready chip, with every request still on the origin.
for (const route of ['/repl', '/l/m03-unions/05-discriminated-unions']) {
  test(`§12 F2: ${route} loaded directly reaches TypeScript 6.0.3 without a request leaving the origin`, async ({
    page,
  }) => {
    const urls = recordRequests(page);
    await page.goto(route);
    await waitForCompilerReady(page);

    expectSameOrigin(page, urls);
    const paths = pathnames(urls);
    expect(
      paths.filter((p) => WORKER_CHUNK.test(p)),
      'the ts-ls worker chunk, requested once',
    ).toHaveLength(1);
    expect(
      new Set(paths.filter((p) => p.startsWith(LIB_BASE))).size,
      'the lib.es2025.d.ts reference chain',
    ).toBe(LIB_CHAIN_LENGTH);
  });
}

// The join budget (spec: Performance budget, F39), on a real production build of the client. It
// builds in a child process: under Vitest NODE_ENV is `test`, which would build React's
// development bundle.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { BUDGET, moduleName, playerChunks, type BundleReport, type OutChunk } from './bundle.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

let report: BundleReport;

beforeAll(() => {
  const json = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/bundle.ts', '--json'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'production' },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  report = JSON.parse(json) as BundleReport;
}, 120_000);

const inPlayer = (pattern: RegExp) => report.playerModules.filter((m) => pattern.test(m));
const inLazy = (pattern: RegExp) =>
  report.lazy.some((chunk) => chunk.modules.some((m) => pattern.test(m)));

describe('the player page (/ and /play)', () => {
  it(`ships at most ${BUDGET.playerJsGzip / 1000} KB of gzipped JavaScript`, () => {
    expect(report.playerJs.length).toBeGreaterThan(0);
    expect(report.playerJsGzip).toBeLessThanOrEqual(BUDGET.playerJsGzip);
  });

  it(`ships at most ${BUDGET.playerCssAndFonts / 1000} KB of CSS and fonts`, () => {
    expect(report.playerCss.length).toBe(1);
    expect(report.fonts.length).toBe(1);
    expect(report.playerCssAndFonts).toBeLessThanOrEqual(BUDGET.playerCssAndFonts);
  });

  it('loads the Screen, Howler and the QR code only as lazy chunks', () => {
    for (const lazy of [
      /^client\/src\/pages\/Screen\.tsx$/,
      /^node_modules\/howler\//,
      /^node_modules\/qrcode\//,
    ]) {
      expect(inPlayer(lazy)).toEqual([]);
      expect(inLazy(lazy)).toBe(true);
    }
  });

  it('holds no Screen component but the settings it shares with the crown phone, and no gallery', () => {
    expect(inPlayer(/^client\/src\/components\/screen\//)).toEqual([
      'client/src/components/screen/ScreenSettings.tsx',
    ]);
    expect(inPlayer(/gallery/i)).toEqual([]);
  });

  it('has no dev bots in a production build', () => {
    expect(report.allModules.filter((m) => /DevBots|client\/src\/dev\//.test(m))).toEqual([]);
  });

  it('bundles no zod anywhere (schemas are checked on the server)', () => {
    expect(report.allModules.filter((m) => /node_modules\/zod\/|shared\/schemas/.test(m))).toEqual(
      [],
    );
  });
});

describe('the display font', () => {
  it('is one preloaded woff2 file, the only font shipped', () => {
    expect(report.assetFiles.filter((f) => /\.(woff2?|ttf|otf|eot)$/.test(f))).toEqual([
      report.fonts[0]!.file,
    ]);
    // Hashed, so it can be cached for good.
    expect(report.fonts[0]!.file).toMatch(/^assets\/fredoka-latin-700-[\w-]+\.woff2$/);
    // Nothing unhashed in client/public either.
    const publicFiles = readdirSync(`${ROOT}client/public`, { recursive: true }).map(String);
    expect(publicFiles.filter((f) => /\.(woff2?|ttf|otf|eot)$/.test(f))).toEqual([]);
    const preload = report.indexHtml.match(/<link\b[^>]*rel="preload"[^>]*>/)![0];
    expect(preload).toMatch(/as="font"/);
    expect(preload).toMatch(/type="font\/woff2"/);
    // Fonts load in CORS mode: without it the preload is wasted and the font downloads twice.
    expect(preload).toMatch(/\bcrossorigin\b/);
  });

  it('is one face with font-display: swap and a Latin unicode-range', () => {
    const faces = report.playerCssText.match(/@font-face\{[^}]*\}/g) ?? [];
    expect(faces).toHaveLength(1);
    expect(faces[0]).toContain(`/${report.fonts[0]!.file}`);
    expect(faces[0]).toMatch(/font-display:\s*swap/);
    // The minifier writes U+0000-00FF as U+??.
    expect(faces[0]).toMatch(/unicode-range:\s*U\+(0+-0*FF|\?\?)[,;}]/i);
  });
});

describe('playerChunks', () => {
  const chunk = (fileName: string, more: Partial<OutChunk> = {}): OutChunk => ({
    type: 'chunk',
    fileName,
    code: '',
    isEntry: false,
    isDynamicEntry: false,
    imports: [],
    dynamicImports: [],
    moduleIds: [],
    ...more,
  });

  it('follows static imports from the entry, not dynamic ones', () => {
    const chunks = [
      chunk('index.js', { isEntry: true, imports: ['vendor.js'], dynamicImports: ['Screen.js'] }),
      chunk('vendor.js', { imports: ['runtime.js'] }),
      chunk('runtime.js'),
      chunk('Screen.js', { isDynamicEntry: true, imports: ['vendor.js', 'qr.js'] }),
      chunk('qr.js'),
    ];
    expect(playerChunks(chunks).map((c) => c.fileName)).toEqual([
      'index.js',
      'vendor.js',
      'runtime.js',
    ]);
  });

  it('names modules from the project root', () => {
    expect(moduleName(`${ROOT}node_modules/howler/dist/howler.js`)).toBe(
      'node_modules/howler/dist/howler.js',
    );
    expect(moduleName(`${ROOT}client/src/App.tsx`)).toBe('client/src/App.tsx');
    expect(moduleName('\0vite/preload-helper.js')).toBe('vite/preload-helper.js');
  });
});

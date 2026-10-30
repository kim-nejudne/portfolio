// The join budget (spec: Performance budget, F39): what `/` and `/play` load before a phone can
// type its name. Both routes are the entry chunk, so the player page is the entry chunk, the
// chunks it imports statically, the stylesheets index.html links and the fonts it preloads.
// Everything reached only through `import()` (the Screen, Howler, QR, the gallery) is lazy.
// `npm run size` builds the client and prints this; scripts/bundle.test.ts fails over budget.
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// SPEC-QUESTION: the budget is measured at gzip level 6 with KB = 1000 bytes, over the entry chunk's
// static imports, linked CSS and preloaded fonts (DECISIONS 61).
/** Bytes. KB here is 1000 bytes, as in Vite's build report. */
export const BUDGET = {
  /** Gzipped JavaScript of `/` and `/play` together. */
  playerJsGzip: 120_000,
  /** Gzipped CSS plus the fonts (already compressed woff2) of `/` and `/play`. */
  playerCssAndFonts: 30_000,
};

/**
 * Gzip level for the measurement: deploy/nginx/sketchy.conf's `gzip_comp_level`, since nginx
 * compresses what the droplet serves.
 */
export const GZIP_LEVEL = 6;

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export interface OutChunk {
  type: 'chunk';
  fileName: string;
  code: string;
  isEntry: boolean;
  isDynamicEntry: boolean;
  imports: string[];
  dynamicImports: string[];
  moduleIds: string[];
}

export interface OutAsset {
  type: 'asset';
  fileName: string;
  source: string | Uint8Array;
}

export interface FileSize {
  file: string;
  bytes: number;
  gzip: number;
}

export interface BundleReport {
  playerJs: FileSize[];
  playerJsGzip: number;
  playerCss: FileSize[];
  /** woff2 files preloaded by index.html (sizes as served; woff2 doesn't gzip). */
  fonts: FileSize[];
  playerCssAndFonts: number;
  /** Modules in the player page's chunks, as paths from the project root. */
  playerModules: string[];
  /** Chunks the player page doesn't load, with their modules. */
  lazy: (FileSize & { modules: string[] })[];
  /** Every module in the build. */
  allModules: string[];
  /** Every emitted file but the JS chunks. */
  assetFiles: string[];
  indexHtml: string;
  /** The player page's stylesheets, concatenated. */
  playerCssText: string;
}

const gzip = (data: string | Uint8Array) => gzipSync(data, { level: GZIP_LEVEL }).length;
const size = (file: string, data: string | Uint8Array): FileSize => ({
  file,
  bytes: typeof data === 'string' ? Buffer.byteLength(data) : data.length,
  gzip: gzip(data),
});

/** `/abs/…/sketchy/node_modules/howler/dist/howler.js` → `node_modules/howler/dist/howler.js`. */
export function moduleName(id: string): string {
  const clean = id.replace(/^\0/, '').split('?')[0]!;
  const nm = clean.lastIndexOf('/node_modules/');
  if (nm >= 0) return clean.slice(nm + 1);
  return clean.startsWith(ROOT) ? clean.slice(ROOT.length) : clean;
}

/** The entry chunks and every chunk they import statically, transitively. */
export function playerChunks(chunks: OutChunk[]): OutChunk[] {
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const seen = new Set<string>();
  const queue = chunks.filter((c) => c.isEntry).map((c) => c.fileName);
  while (queue.length > 0) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    queue.push(...(byName.get(name)?.imports ?? []));
  }
  return chunks.filter((c) => seen.has(c.fileName));
}

/** Measures a client build's output. */
export function measure(output: (OutChunk | OutAsset)[]): BundleReport {
  const chunks = output.filter((o): o is OutChunk => o.type === 'chunk');
  const assets = new Map(
    output.filter((o): o is OutAsset => o.type === 'asset').map((a) => [a.fileName, a.source]),
  );
  const html = assets.get('index.html');
  if (html === undefined) throw new Error('The build has no index.html.');
  const indexHtml = typeof html === 'string' ? html : Buffer.from(html).toString('utf8');

  const player = playerChunks(chunks);
  const playerJs = player.map((c) => size(c.fileName, c.code));
  const lazy = chunks
    .filter((c) => !player.includes(c))
    .map((c) => ({ ...size(c.fileName, c.code), modules: c.moduleIds.map(moduleName) }));

  const hrefs = (rel: string) =>
    [...indexHtml.matchAll(/<link\b[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => new RegExp(`\\brel="${rel}"`).test(tag))
      .map((tag) => /\bhref="\/([^"]+)"/.exec(tag)?.[1])
      .filter((href): href is string => href !== undefined);

  const cssFiles = hrefs('stylesheet');
  const playerCss = cssFiles.map((file) => {
    const source = assets.get(file);
    if (source === undefined) throw new Error(`index.html links ${file}, which isn't built.`);
    return size(file, source);
  });
  const playerCssText = cssFiles
    .map((file) => {
      const source = assets.get(file)!;
      return typeof source === 'string' ? source : Buffer.from(source).toString('utf8');
    })
    .join('\n');
  const fonts = hrefs('preload')
    .filter((href) => href.endsWith('.woff2'))
    .map((file) => {
      const source = assets.get(file);
      if (source === undefined) throw new Error(`index.html preloads ${file}, which isn't built.`);
      const bytes = typeof source === 'string' ? Buffer.byteLength(source) : source.length;
      return { file, bytes, gzip: bytes };
    });

  const sum = (list: FileSize[], key: 'bytes' | 'gzip') => list.reduce((n, f) => n + f[key], 0);
  return {
    playerJs,
    playerJsGzip: sum(playerJs, 'gzip'),
    playerCss,
    fonts,
    playerCssAndFonts: sum(playerCss, 'gzip') + sum(fonts, 'bytes'),
    playerModules: player.flatMap((c) => c.moduleIds.map(moduleName)),
    lazy,
    allModules: chunks.flatMap((c) => c.moduleIds.map(moduleName)),
    assetFiles: [...assets.keys()],
    indexHtml,
    playerCssText,
  };
}

/** Builds the client in production mode, in memory, and measures it. */
export async function buildAndMeasure(): Promise<BundleReport> {
  const { build } = await import('vite');
  const result = await build({
    root: `${ROOT}client`,
    configFile: `${ROOT}vite.config.ts`,
    mode: 'production',
    logLevel: 'silent',
    build: { write: false },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const output = outputs.flatMap((o) => ('output' in o ? o.output : [])) as unknown as (
    OutChunk | OutAsset
  )[];
  return measure(output);
}

const kb = (n: number) => `${(n / 1000).toFixed(1)} KB`;

async function main() {
  // A development NODE_ENV would build React's development bundle.
  process.env.NODE_ENV = 'production';
  const report = await buildAndMeasure();
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(report));
    return;
  }
  console.log(`/ and /play, gzip level ${GZIP_LEVEL}:`);
  for (const f of report.playerJs) console.log(`  ${f.file}  ${kb(f.gzip)}`);
  console.log(`  JS ${kb(report.playerJsGzip)} of ${kb(BUDGET.playerJsGzip)}`);
  for (const f of [...report.playerCss, ...report.fonts]) console.log(`  ${f.file}  ${kb(f.gzip)}`);
  console.log(`  CSS and fonts ${kb(report.playerCssAndFonts)} of ${kb(BUDGET.playerCssAndFonts)}`);
  console.log('Lazy chunks:');
  for (const f of report.lazy) console.log(`  ${f.file}  ${kb(f.gzip)}`);
  const over =
    report.playerJsGzip > BUDGET.playerJsGzip ||
    report.playerCssAndFonts > BUDGET.playerCssAndFonts;
  if (over) {
    console.error('Over the join budget.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();

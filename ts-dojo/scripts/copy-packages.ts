// Writes the pre-bundled packages (src/protocol/packages.ts; §8 17.2 "Zod pre-bundled", 17.4
// "React's types pre-bundled"; §12 F14) into public/packages/, where the ts-ls worker fetches the
// declaration files and the sandbox imports Zod's runtime, and the service worker precaches
// both (vite.config.ts):
//
// - types.json: every package's declaration files at their virtual-FS paths, the set
//   src/workers/ts-ls/node/package-types.ts collects from node_modules;
// - zod-<version>.js: the installed zod as one self-contained, minified ES module, bundled by
//   a nested `vite build`, so Node (the lint) and Chrome run the same version of the code.
//
// Runs under tsx (`pnpm copy-packages`; `pnpm dev` and `pnpm build` run it after copy-ts-libs)
// because it shares the collector with the worker core's Node side.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type Rollup } from 'vite';
import {
  PACKAGE_TYPES_URL,
  PACKAGES,
  ZOD_VERSION,
} from '../src/protocol/packages.ts';
import { collectPackageTypes } from '../src/workers/ts-ls/node/package-types.ts';

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
export const PACKAGES_TARGET = path.join(ROOT, 'public', 'packages');

/** The installed zod as one ES module with every export of `zod`, the default included. */
export async function bundleZod(): Promise<string> {
  // zod's own ES entry (index.js) re-exports the whole API and the default, so it is the
  // bundle's entry as it is.
  const entry = fileURLToPath(import.meta.resolve('zod'));
  const output = await build({
    configFile: false,
    root: ROOT,
    logLevel: 'warn',
    build: {
      write: false,
      minify: true,
      copyPublicDir: false,
      lib: { entry, formats: ['es'], fileName: 'zod' },
    },
  });
  const results = (
    Array.isArray(output) ? output : [output]
  ) as Rollup.RollupOutput[];
  const chunks = results
    .flatMap((r) => r.output)
    .filter((o): o is Rollup.OutputChunk => o.type === 'chunk');
  if (chunks.length !== 1 || chunks[0] === undefined) {
    throw new Error(
      `bundling zod gave ${String(chunks.length)} chunks; one self-contained module is needed`,
    );
  }
  return chunks[0].code;
}

export interface CopyPackagesResult {
  files: { name: string; bytes: number }[];
}

export async function copyPackages(
  to: string = PACKAGES_TARGET,
): Promise<CopyPackagesResult> {
  mkdirSync(to, { recursive: true });
  const wanted = new Map<string, string>([
    [path.basename(PACKAGE_TYPES_URL), JSON.stringify(collectPackageTypes())],
  ]);
  const zod = PACKAGES.find((p) => p.name === 'zod')?.runtimeUrl;
  if (zod === undefined || zod === null)
    throw new Error('zod has no runtime URL');
  wanted.set(path.basename(zod), await bundleZod());
  // A bundle of an older zod version is stale once the version changes.
  for (const existing of readdirSync(to)) {
    if (!wanted.has(existing)) rmSync(path.join(to, existing));
  }
  const files = [...wanted].map(([name, text]) => {
    writeFileSync(path.join(to, name), text);
    return { name, bytes: Buffer.byteLength(text) };
  });
  return { files };
}

const runDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runDirectly) {
  const result = await copyPackages();
  for (const file of result.files) {
    console.log(
      `wrote ${path.relative(ROOT, path.join(PACKAGES_TARGET, file.name))} (${file.bytes.toLocaleString('en-US')} bytes)`,
    );
  }
  console.log(`zod ${ZOD_VERSION}`);
}

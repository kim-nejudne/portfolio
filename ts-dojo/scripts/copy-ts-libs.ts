// Copies typescript's lib.*.d.ts files into public/ts/<version>/ (spec §2 Compiler assets),
// where the ts-ls worker fetches them on demand and the service worker precaches them.
// Runs under Node 24 directly (`node scripts/copy-ts-libs.ts`, erasable syntax only) and is
// imported by scripts/copy-ts-libs.test.ts. pnpm build runs it before vite build (§2 Build).
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
export const TS_PACKAGE_DIR = path.join(ROOT, 'node_modules', 'typescript');
export const TS_LIB_DIR = path.join(TS_PACKAGE_DIR, 'lib');

/** lib.<name>.d.ts, and nothing else that lives in typescript/lib (typescript.js, typescript.d.ts, ...). */
export function isLibFile(name: string): boolean {
  return /^lib\..+\.d\.ts$/.test(name);
}

/** The installed typescript version; the target folder is named after it (6.0.3 per §2). */
export function typescriptVersion(): string {
  const pkg = JSON.parse(
    readFileSync(path.join(TS_PACKAGE_DIR, 'package.json'), 'utf8'),
  ) as { version: string };
  return pkg.version;
}

export function libTarget(version: string = typescriptVersion()): string {
  return path.join(ROOT, 'public', 'ts', version);
}

export interface CopiedFile {
  name: string;
  bytes: number;
}

export interface CopyResult {
  files: CopiedFile[];
  total: number;
  /** lib.*.d.ts files that were in the target but are not in the source any more. */
  removed: string[];
}

export function copyTsLibs(
  options: { from?: string; to?: string } = {},
): CopyResult {
  const from = options.from ?? TS_LIB_DIR;
  const to = options.to ?? libTarget();
  const names = readdirSync(from).filter(isLibFile).sort();
  mkdirSync(to, { recursive: true });

  const wanted = new Set(names);
  const removed: string[] = [];
  for (const existing of readdirSync(to)) {
    if (isLibFile(existing) && !wanted.has(existing)) {
      rmSync(path.join(to, existing));
      removed.push(existing);
    }
  }

  const files = names.map((name): CopiedFile => {
    copyFileSync(path.join(from, name), path.join(to, name));
    return { name, bytes: statSync(path.join(to, name)).size };
  });
  return {
    files,
    total: files.reduce((sum, file) => sum + file.bytes, 0),
    removed,
  };
}

const runDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runDirectly) {
  const to = libTarget();
  const result = copyTsLibs({ to });
  const bytes = result.total.toLocaleString('en-US');
  console.log(
    `copied ${result.files.length} lib files (${bytes} bytes) from typescript ${typescriptVersion()} to ${path.relative(ROOT, to)}/`,
  );
  if (result.removed.length > 0)
    console.log(`removed stale: ${result.removed.join(', ')}`);
}

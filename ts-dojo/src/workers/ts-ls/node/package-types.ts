// The Node side of the pre-bundled packages (src/protocol/packages.ts): every declaration file
// TypeScript reads for `import { z } from 'zod'` and for a `react-jsx` `.tsx` file, taken from
// node_modules and placed at the virtual-FS path the ts-ls worker mounts it under
// (`/node_modules/zod/index.d.cts`), plus each package's package.json for the `exports` map.
// scripts/copy-packages.ts writes the result to public/packages/types.json for the browser;
// Vitest, the content lint and the build's renderer use it directly. The set is what a real
// program over a probe file reads, so it is closed by construction. Node only.
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  DEFAULT_COMPILER_OPTIONS,
  type CompilerOptionsJson,
} from '@/protocol/ts-ls';
import { PACKAGES, PACKAGES_ROOT, type PackageFile } from '@/protocol/packages';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const PROBE_DIR = path.join(ROOT, '__dojo-package-probe__');

/** The probe: one file per shipped package, plus one per build-only extra (valibot for twoslash). */
function probeFiles(extra: readonly string[]): Map<string, string> {
  const files = new Map<string, string>([
    [
      path.join(PROBE_DIR, 'zod.ts'),
      "import { z } from 'zod';\nexport type Probe = z.infer<ReturnType<typeof z.object>>;\n",
    ],
    [
      path.join(PROBE_DIR, 'react.tsx'),
      "import { useState, type ReactNode } from 'react';\nexport function Probe(props: { children: ReactNode }) {\n  const [n] = useState(0);\n  return <div>{props.children}{n}</div>;\n}\n",
    ],
  ]);
  extra.forEach((name, i) => {
    files.set(
      path.join(PROBE_DIR, `extra-${String(i)}.ts`),
      `import * as probe from '${name}';\nexport type Probe = typeof probe;\n`,
    );
  });
  return files;
}

function probeOptions(): ts.CompilerOptions {
  const json: CompilerOptionsJson = {
    ...DEFAULT_COMPILER_OPTIONS,
    jsx: 'react-jsx',
    noEmit: true,
  };
  const { options, errors } = ts.convertCompilerOptionsFromJson(json, ROOT);
  if (errors.length > 0) {
    throw new Error(
      errors
        .map((e) => ts.flattenDiagnosticMessageText(e.messageText, ' '))
        .join('; '),
    );
  }
  return options;
}

/** `/home/…/.pnpm/zod@4.6.7/node_modules/zod/v4/core/api.d.cts` → `zod/v4/core/api.d.cts`. */
function packageRelative(fileName: string): string | null {
  const real = realpathSync(fileName).split(path.sep).join('/');
  const marker = '/node_modules/';
  const index = real.lastIndexOf(marker);
  return index < 0 ? null : real.slice(index + marker.length);
}

/** `@types/react/index.d.ts` → `@types/react`; `zod/v4/x.d.cts` → `zod`. */
function packageName(relative: string): string {
  const parts = relative.split('/');
  return relative.startsWith('@')
    ? `${parts[0] ?? ''}/${parts[1] ?? ''}`
    : (parts[0] ?? '');
}

const cache = new Map<string, PackageFile[]>();

/**
 * Every declaration file of the shipped packages (and of `extra`, for the build only), with
 * each package's package.json, sorted by path. Throws when the probe does not compile, so a
 * package that stops resolving fails loudly here rather than as TS2307 in a lesson.
 */
export function collectPackageTypes(
  extra: readonly string[] = [],
): PackageFile[] {
  const key = extra.join(',');
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const probes = probeFiles(extra);
  const options = probeOptions();
  const host = ts.createCompilerHost(options, true);
  const real = ts.createCompilerHost(options, true);
  host.fileExists = (fileName) =>
    probes.has(fileName) || real.fileExists(fileName);
  host.readFile = (fileName) => probes.get(fileName) ?? real.readFile(fileName);
  host.getSourceFile = (fileName, languageVersion, ...rest) => {
    const text = probes.get(fileName);
    return text === undefined
      ? real.getSourceFile(fileName, languageVersion, ...rest)
      : ts.createSourceFile(fileName, text, languageVersion, true);
  };
  const program = ts.createProgram([...probes.keys()], options, host);
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file !== undefined && probes.has(d.file.fileName));
  if (errors.length > 0) {
    throw new Error(
      `the package probe does not compile: ${errors
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '))
        .join('; ')}`,
    );
  }

  const shipped = new Set([...PACKAGES.flatMap((p) => p.typesFrom), ...extra]);
  const byPath = new Map<string, string>();
  const packageDirs = new Map<string, string>();
  for (const sourceFile of program.getSourceFiles()) {
    if (probes.has(sourceFile.fileName)) continue;
    if (program.isSourceFileDefaultLibrary(sourceFile)) continue;
    const relative = packageRelative(sourceFile.fileName);
    if (relative === null) continue;
    const name = packageName(relative);
    if (name === 'typescript') continue;
    if (!shipped.has(name)) {
      throw new Error(
        `the package probe reads ${relative}, from a package that is not shipped`,
      );
    }
    byPath.set(`${PACKAGES_ROOT}${relative}`, sourceFile.text);
    const real = realpathSync(sourceFile.fileName);
    const dir = real.slice(0, real.length - relative.length + name.length);
    packageDirs.set(name, dir);
  }
  for (const [name, dir] of packageDirs) {
    byPath.set(
      `${PACKAGES_ROOT}${name}/package.json`,
      readFileSync(path.join(dir, 'package.json'), 'utf8'),
    );
  }
  for (const name of shipped) {
    if (!packageDirs.has(name)) {
      throw new Error(`the package probe never read ${name}`);
    }
  }
  const files = [...byPath]
    .map(([p, text]) => ({ path: p, text }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  cache.set(key, files);
  return files;
}

/** The `loadPackageTypes` the ts-ls core takes, for Node. */
export const nodeLoadPackageTypes = (): Promise<PackageFile[]> =>
  Promise.resolve(collectPackageTypes());

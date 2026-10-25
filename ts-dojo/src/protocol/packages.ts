// The two libraries the course ships pre-bundled (spec Summary "the two lessons that need a
// library ship it pre-bundled"; §8 17.2 "Zod pre-bundled", 17.4 "React's types pre-bundled";
// F14, Kim's decisions with the F14 plan on 23 October 2026, under Deviations in
// docs/progress.md). Both sides import this table:
//
// - the ts-ls worker mounts every package's declaration files under the reserved
//   `/node_modules/` root of its virtual FS, so `import { z } from 'zod'` and React's types
//   resolve in every project, `/repl` included (scripts/copy-packages.ts writes them to
//   /packages/types.json; Node reads them from node_modules, src/workers/ts-ls/node/package-types.ts);
// - the sandbox resolves a package with a runtime (Zod) to its pre-bundled ES module
//   (/packages/zod-<version>.js) and refuses one without (React) with a message saying so.

/** A declaration file of a package, at its virtual-FS path (`/node_modules/zod/index.d.cts`). */
export interface PackageFile {
  path: string;
  text: string;
}

/** The virtual-FS root the package files live under; never a user file (§2 paths). */
export const PACKAGES_ROOT = '/node_modules/';

/** Where the browser fetches every package's declaration files, one JSON array of `PackageFile`. */
export const PACKAGE_TYPES_URL = '/packages/types.json';

export interface PackageSpec {
  /** The import specifier, and the root of its subpath specifiers (`react/jsx-runtime`). */
  name: string;
  /** The npm packages whose declarations are shipped, in the order they are resolved. */
  typesFrom: readonly string[];
  /** The installed version the bundle and the declarations come from. */
  version: string;
  /** The pre-bundled ES module the sandbox imports, or null when only the types ship. */
  runtimeUrl: string | null;
}

export const ZOD_VERSION = '4.6.7';
export const REACT_TYPES_VERSION = '19.3.0';

export const PACKAGES: readonly PackageSpec[] = [
  {
    name: 'zod',
    typesFrom: ['zod'],
    version: ZOD_VERSION,
    runtimeUrl: `/packages/zod-${ZOD_VERSION}.js`,
  },
  {
    name: 'react',
    typesFrom: ['@types/react', 'csstype'],
    version: REACT_TYPES_VERSION,
    runtimeUrl: null,
  },
];

/** The package an import specifier names (`zod`, `react/jsx-runtime` → react), or null. */
export function packageOf(specifier: string): PackageSpec | null {
  return (
    PACKAGES.find(
      (p) => specifier === p.name || specifier.startsWith(`${p.name}/`),
    ) ?? null
  );
}

/** The sandbox's message for an import of a package that ships its types only. */
export function typesOnlyMessage(name: string): string {
  const display = name === 'react' ? 'React' : name;
  return `${display} has types only in the dojo; its runtime isn't bundled`;
}

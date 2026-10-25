// Loads and runs an emitted project without a bundler (§2 Decisions, §13). ES modules: each
// module becomes a URL (a blob URL in the worker, a `data:` URL in Node tests) with its import
// specifiers rewritten to the URLs of its dependencies, built leaves first, then the entry is
// imported; top-level `await` just works. A cyclic graph cannot be built that way (each URL
// needs the other's text), so the runner re-emits it as CommonJS and this loader wraps each
// module in a factory, imports every wrapper, and runs the entry with a cached `require`, the
// way Node resolves cycles (partial exports). A pre-bundled package (zod, §12 F14) is imported
// from `packageUrl(name)`: /packages/zod-<version>.js in the browser, the installed package in
// Node. Pure apart from the injected `createUrl`, `importModule` and `packageUrl`.
import { PACKAGES } from '@/protocol/packages';
import type { RunRequest } from '@/protocol/sandbox';
import {
  orderModules,
  packageImportName,
  resolvePackage,
  resolveSpecifier,
} from './modules';
import { rewriteImports } from './modules';
import type { LoadedModule } from './prelude';

export interface LoaderIo {
  createUrl: (js: string) => string;
  importModule: (url: string) => Promise<Record<string, unknown>>;
  /** Told about each module once its URL exists, so stack frames can be mapped. */
  register: (module: LoadedModule) => void;
  /** The absolute URL of a pre-bundled package's ES module (`zod`). */
  packageUrl: (name: string) => string;
}

/** The pre-bundled packages a run can import (zod). */
const RUNTIME_PACKAGES = PACKAGES.filter((p) => p.runtimeUrl !== null).map(
  (p) => p.name,
);

/** The line the CommonJS wrapper adds above the module text. */
export const CJS_WRAPPER_HEAD =
  'export default function (require, exports, module) {\n';
export const CJS_LINE_OFFSET = 1;

type CjsFactory = (
  require: (specifier: string) => unknown,
  exports: Record<string, unknown>,
  module: { exports: Record<string, unknown> },
) => void;

export async function runModules(
  request: Pick<RunRequest, 'modules' | 'entry' | 'format'>,
  io: LoaderIo,
): Promise<void> {
  const { modules, entry, format } = request;
  if (!modules.some((m) => m.path === entry)) {
    throw new Error(`entry ${entry} is not among the emitted modules`);
  }
  if (format === 'esm') {
    const ordered = orderModules(modules);
    if ('cycle' in ordered) {
      throw new Error('cyclic imports need the CommonJS format');
    }
    const urls = new Map<string, string>();
    for (const module of ordered.order) {
      const js = rewriteImports(module, (path) => {
        const name = packageImportName(path);
        if (name !== null) return io.packageUrl(name);
        const url = urls.get(path);
        if (url === undefined)
          throw new Error(`${path} was not loaded before ${module.path}`);
        return url;
      });
      const url = io.createUrl(js);
      urls.set(module.path, url);
      io.register({ url, path: module.path, js, lineOffset: 0 });
    }
    await io.importModule(urls.get(entry) as string);
    return;
  }
  const paths = modules.map((m) => m.path);
  const factories = new Map<string, CjsFactory>();
  await Promise.all(
    modules.map(async (module) => {
      const js = `${CJS_WRAPPER_HEAD}${module.js}\n}`;
      const url = io.createUrl(js);
      io.register({
        url,
        path: module.path,
        js: module.js,
        lineOffset: CJS_LINE_OFFSET,
      });
      const loaded = await io.importModule(url);
      factories.set(module.path, loaded.default as CjsFactory);
    }),
  );
  // Packages are ES modules: imported up front, so `require` can hand back the namespace.
  // CommonJS output reports no imports (its `require` calls resolve at run time), so the
  // texts are searched for a require of each package that has a runtime.
  const packages = new Map<string, Record<string, unknown>>();
  for (const name of RUNTIME_PACKAGES) {
    const call = new RegExp(`\\brequire\\((["'])${name}\\1\\)`);
    if (modules.some((m) => call.test(m.js))) {
      packages.set(name, await io.importModule(io.packageUrl(name)));
    }
  }
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  const load = (path: string): Record<string, unknown> => {
    const cached = cache.get(path);
    if (cached !== undefined) return cached.exports;
    const factory = factories.get(path);
    if (factory === undefined) throw new Error(`no module at ${path}`);
    const module = { exports: {} as Record<string, unknown> };
    cache.set(path, module);
    const require = (specifier: string): unknown => {
      const packagePath = resolvePackage(specifier);
      const pkg =
        packagePath === null
          ? undefined
          : packages.get(packageImportName(packagePath) ?? '');
      if (pkg !== undefined) return pkg;
      const target = resolveSpecifier(path, specifier, paths);
      if (target === null) {
        throw new Error(
          `${path.slice(1)} requires '${specifier}', which is not a file of this project`,
        );
      }
      return load(target);
    };
    factory(require, module.exports, module);
    return module.exports;
  };
  load(entry);
}

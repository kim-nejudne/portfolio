// The module graph of an emitted project (§2 Decisions: multi-file projects run through
// blob-URL import rewriting; §13: the resolver mirrors `moduleResolution: bundler`, cycles
// fall back to CommonJS). Pure: the runner resolves and orders on the main thread, the worker
// rewrites the specifiers with the same functions.
import {
  packageOf,
  PACKAGES_ROOT,
  typesOnlyMessage,
} from '@/protocol/packages';
import type { ResolvedImport, SandboxModule } from '@/protocol/sandbox';

/** An import as ts reports it in the emitted text, before resolution. */
export interface ModuleImport {
  specifier: string;
  start: number;
  end: number;
}

export interface EmittedModule {
  path: string;
  js: string;
  imports: ModuleImport[];
}

const EXTENSIONS = ['.ts', '.tsx'];

function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return `/${out.join('/')}`;
}

/**
 * `./shapes` from `/index.ts` → `/shapes.ts`: relative specifiers only, extensionless or with
 * `.js`/`.ts` (bundler resolution maps `.js` to the `.ts` source), a directory's `index.ts`.
 * A bare specifier never resolves: the sandbox has no packages.
 */
export function resolveSpecifier(
  from: string,
  specifier: string,
  paths: readonly string[],
): string | null {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null;
  const dir = from.slice(0, from.lastIndexOf('/') + 1);
  const base = normalize(dir + specifier);
  const has = (p: string): boolean => paths.includes(p);
  const candidates = [
    base,
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.jsx$/, '.tsx'),
  ];
  for (const c of candidates) if (has(c)) return c;
  for (const ext of EXTENSIONS) if (has(base + ext)) return base + ext;
  for (const ext of EXTENSIONS)
    if (has(`${base}/index${ext}`)) return `${base}/index${ext}`;
  return null;
}

export interface ResolveFailure {
  path: string;
  specifier: string;
  /** The pre-bundled package the specifier names when that package ships its types only. */
  typesOnly?: string;
}

/**
 * A pre-bundled package with a runtime (src/protocol/packages.ts, §12 F14) imported by its
 * exact name: `zod` → `/node_modules/zod`, a path no project file can have. Null otherwise.
 */
export function resolvePackage(specifier: string): string | null {
  const spec = packageOf(specifier);
  return spec !== null && spec.runtimeUrl !== null && specifier === spec.name
    ? `${PACKAGES_ROOT}${spec.name}`
    : null;
}

/** `/node_modules/zod` → `zod`; null for a project path. */
export function packageImportName(path: string): string | null {
  return path.startsWith(PACKAGES_ROOT)
    ? path.slice(PACKAGES_ROOT.length)
    : null;
}

/** Every import resolved to a project path or a pre-bundled package, or the first failure. */
export function resolveModules(
  modules: readonly EmittedModule[],
): { modules: SandboxModule[] } | { failure: ResolveFailure } {
  const paths = modules.map((m) => m.path);
  const resolved: SandboxModule[] = [];
  for (const module of modules) {
    const imports: ResolvedImport[] = [];
    for (const imp of module.imports) {
      const target =
        resolveSpecifier(module.path, imp.specifier, paths) ??
        resolvePackage(imp.specifier);
      if (target === null) {
        const spec = packageOf(imp.specifier);
        const failure: ResolveFailure = {
          path: module.path,
          specifier: imp.specifier,
        };
        if (spec !== null && spec.runtimeUrl === null) {
          failure.typesOnly = spec.name;
        }
        return { failure };
      }
      imports.push({ ...imp, path: target });
    }
    resolved.push({ path: module.path, js: module.js, imports });
  }
  return { modules: resolved };
}

export function describeResolveFailure(failure: ResolveFailure): string {
  const where = `${failure.path.slice(1)} imports '${failure.specifier}'`;
  return failure.typesOnly !== undefined
    ? `${where}: ${typesOnlyMessage(failure.typesOnly)}`
    : `${where}, which is not a file of this project`;
}

/**
 * Dependencies first (so a leaf's URL exists before the module that imports it is built), or
 * the cycle found as the path of modules that closes on itself.
 */
export function orderModules(
  modules: readonly SandboxModule[],
): { order: SandboxModule[] } | { cycle: string[] } {
  const byPath = new Map(modules.map((m) => [m.path, m]));
  const state = new Map<string, 'visiting' | 'done'>();
  const order: SandboxModule[] = [];
  const stack: string[] = [];
  const visit = (path: string): string[] | null => {
    const mark = state.get(path);
    if (mark === 'done') return null;
    if (mark === 'visiting') {
      return [...stack.slice(stack.indexOf(path)), path];
    }
    const module = byPath.get(path);
    if (module === undefined) return null;
    state.set(path, 'visiting');
    stack.push(path);
    for (const imp of module.imports) {
      const cycle = visit(imp.path);
      if (cycle !== null) return cycle;
    }
    stack.pop();
    state.set(path, 'done');
    order.push(module);
    return null;
  };
  for (const module of modules) {
    const cycle = visit(module.path);
    if (cycle !== null) return { cycle };
  }
  return { order };
}

export function describeCycle(cycle: readonly string[]): string {
  return cycle.map((p) => p.slice(1)).join(' → ');
}

/** `js` with every import specifier replaced by `urlOf(path)`, right to left so spans stay valid. */
export function rewriteImports(
  module: SandboxModule,
  urlOf: (path: string) => string,
): string {
  const sorted = [...module.imports].sort((a, b) => b.start - a.start);
  let js = module.js;
  for (const imp of sorted) {
    js = js.slice(0, imp.start) + urlOf(imp.path) + js.slice(imp.end);
  }
  return js;
}

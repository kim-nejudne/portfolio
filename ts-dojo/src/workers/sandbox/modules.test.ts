// The module graph (§2 Decisions, §13): bundler-style resolution within the project, the
// dependency order the ESM loader builds blob URLs in, cycle detection for the CommonJS
// fallback, and the specifier rewriting.
import { describe, expect, it } from 'vitest';
import type { SandboxModule } from '@/protocol/sandbox';
import {
  describeCycle,
  describeResolveFailure,
  packageImportName,
  orderModules,
  resolveModules,
  resolveSpecifier,
  rewriteImports,
} from './modules';

const PATHS = ['/index.ts', '/shapes.ts', '/util/index.ts', '/view.tsx'];

describe('resolveSpecifier', () => {
  it('resolves relative specifiers the way bundler resolution does', () => {
    expect(resolveSpecifier('/index.ts', './shapes', PATHS)).toBe('/shapes.ts');
    expect(resolveSpecifier('/index.ts', './shapes.js', PATHS)).toBe(
      '/shapes.ts',
    );
    expect(resolveSpecifier('/index.ts', './shapes.ts', PATHS)).toBe(
      '/shapes.ts',
    );
    expect(resolveSpecifier('/index.ts', './util', PATHS)).toBe(
      '/util/index.ts',
    );
    expect(resolveSpecifier('/util/index.ts', '../view', PATHS)).toBe(
      '/view.tsx',
    );
    expect(resolveSpecifier('/util/index.ts', './../view.jsx', PATHS)).toBe(
      '/view.tsx',
    );
  });

  it('never resolves a bare or a missing specifier', () => {
    expect(resolveSpecifier('/index.ts', 'lodash', PATHS)).toBeNull();
    expect(resolveSpecifier('/index.ts', './nope', PATHS)).toBeNull();
    expect(resolveSpecifier('/index.ts', '/shapes', PATHS)).toBeNull();
  });
});

const mod = (
  path: string,
  deps: string[],
  js = `${deps.map((d) => `import '${d}';`).join('\n')}\nexport const at = '${path}';`,
): SandboxModule => {
  const imports = deps.map((d) => {
    const start = js.indexOf(`'${d}'`) + 1;
    return { specifier: d, path: '', start, end: start + d.length };
  });
  return { path, js, imports };
};

describe('resolveModules', () => {
  it('fills in the resolved path of each import', () => {
    const result = resolveModules([
      mod('/index.ts', ['./shapes']),
      mod('/shapes.ts', []),
    ]);
    expect('modules' in result && result.modules[0]?.imports[0]?.path).toBe(
      '/shapes.ts',
    );
  });

  it('reports the first import that is not a project file', () => {
    const result = resolveModules([
      mod('/index.ts', ['./shapes', 'lodash']),
      mod('/shapes.ts', []),
    ]);
    expect(result).toEqual({
      failure: { path: '/index.ts', specifier: 'lodash' },
    });
    if ('failure' in result) {
      expect(describeResolveFailure(result.failure)).toBe(
        "index.ts imports 'lodash', which is not a file of this project",
      );
    }
  });
});

describe('resolveModules, the pre-bundled packages (§12 F14)', () => {
  it('resolves zod to its package path', () => {
    const result = resolveModules([mod('/index.ts', ['zod'])]);
    expect('modules' in result && result.modules[0]?.imports[0]?.path).toBe(
      '/node_modules/zod',
    );
    expect(packageImportName('/node_modules/zod')).toBe('zod');
    expect(packageImportName('/index.ts')).toBeNull();
  });

  it('refuses react and its subpaths: React ships its types only', () => {
    for (const specifier of ['react', 'react/jsx-runtime']) {
      const result = resolveModules([mod('/index.tsx', [specifier])]);
      expect(result).toEqual({
        failure: { path: '/index.tsx', specifier, typesOnly: 'react' },
      });
      if ('failure' in result) {
        expect(describeResolveFailure(result.failure)).toBe(
          `index.tsx imports '${specifier}': React has types only in the dojo; its runtime isn't bundled`,
        );
      }
    }
  });

  it('a subpath of zod is not bundled: the usual message', () => {
    const result = resolveModules([mod('/index.ts', ['zod/mini'])]);
    expect(result).toEqual({
      failure: { path: '/index.ts', specifier: 'zod/mini' },
    });
  });
});

const resolved = (modules: SandboxModule[]): SandboxModule[] => {
  const r = resolveModules(modules);
  if ('failure' in r) throw new Error('unexpected failure');
  return r.modules;
};

describe('orderModules', () => {
  it('puts dependencies before the modules that import them', () => {
    const order = orderModules(
      resolved([
        mod('/index.ts', ['./a', './b']),
        mod('/a.ts', ['./b']),
        mod('/b.ts', []),
      ]),
    );
    expect('order' in order && order.order.map((m) => m.path)).toEqual([
      '/b.ts',
      '/a.ts',
      '/index.ts',
    ]);
  });

  it('reports a cycle as the path that closes on itself', () => {
    const result = orderModules(
      resolved([
        mod('/index.ts', ['./a']),
        mod('/a.ts', ['./b']),
        mod('/b.ts', ['./a']),
      ]),
    );
    expect(result).toEqual({ cycle: ['/a.ts', '/b.ts', '/a.ts'] });
    if ('cycle' in result)
      expect(describeCycle(result.cycle)).toBe('a.ts → b.ts → a.ts');
  });

  it('treats a self-import as a cycle', () => {
    expect(orderModules(resolved([mod('/index.ts', ['./index'])]))).toEqual({
      cycle: ['/index.ts', '/index.ts'],
    });
  });
});

describe('rewriteImports', () => {
  it('replaces each specifier with its URL and keeps the rest of the text', () => {
    const [index] = resolved([
      mod('/index.ts', ['./a', './b']),
      mod('/a.ts', []),
      mod('/b.ts', []),
    ]);
    expect(rewriteImports(index!, (p) => `blob:${p}`)).toBe(
      "import 'blob:/a.ts';\nimport 'blob:/b.ts';\nexport const at = '/index.ts';",
    );
  });
});

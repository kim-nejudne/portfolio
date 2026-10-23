// The loader on real `ts.transpileModule` output in Node, through `data:` URLs (the worker uses
// blob URLs; the logic is the same). §12 F4 criterion 4: two files importing each other
// without a cycle run in dependency order, a cycle runs through CommonJS; criterion 5:
// top-level await in a single file; criterion 3: a thrown error carries its TypeScript line.
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { ModuleFormat, SandboxModule } from '@/protocol/sandbox';
import { runModules, type LoaderIo } from './loader';
import { resolveModules, type EmittedModule } from './modules';
import { createModuleRegistry } from './prelude';

function emit(path: string, text: string, format: ModuleFormat): EmittedModule {
  const output = ts.transpileModule(text, {
    fileName: path,
    compilerOptions: {
      target: ts.ScriptTarget.ES2025,
      module: format === 'esm' ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      isolatedModules: true,
      inlineSourceMap: true,
      inlineSources: true,
    },
  }).outputText;
  const imports = ts
    .preProcessFile(output, true, false)
    .importedFiles.map((f) => ({
      specifier: f.fileName,
      start: f.pos + 1,
      end: f.pos + 1 + f.fileName.length,
    }));
  return { path, js: output, imports };
}

function project(
  files: Record<string, string>,
  format: ModuleFormat,
): SandboxModule[] {
  const resolved = resolveModules(
    Object.entries(files).map(([path, text]) => emit(path, text, format)),
  );
  if ('failure' in resolved) throw new Error('unresolved import in a fixture');
  return resolved.modules;
}

function nodeIo() {
  const registry = createModuleRegistry();
  const io: LoaderIo = {
    createUrl: (js) =>
      `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`,
    importModule: (url) => import(url) as Promise<Record<string, unknown>>,
    register: (module) => {
      registry.register(module);
    },
    packageUrl: (name) => import.meta.resolve(name),
  };
  return { io, registry };
}

/** The fixtures log through a global the test owns (the worker's prelude installs its own). */
function captureLogs(): { logs: string[]; restore: () => void } {
  const logs: string[] = [];
  const original = globalThis.console.log;
  globalThis.console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  return { logs, restore: () => (globalThis.console.log = original) };
}

describe('runModules', () => {
  it('runs two files without a cycle in dependency order', async () => {
    const { logs, restore } = captureLogs();
    try {
      await runModules(
        {
          entry: '/index.ts',
          format: 'esm',
          modules: project(
            {
              '/index.ts':
                "import { area } from './shapes';\nconsole.log('index', area(2));\n",
              '/shapes.ts':
                "console.log('shapes');\nexport const area = (r: number): number => r * r;\n",
            },
            'esm',
          ),
        },
        nodeIo().io,
      );
    } finally {
      restore();
    }
    expect(logs).toEqual(['shapes', 'index 4']);
  });

  it('refuses a cycle in ESM and runs it through CommonJS with partial exports', async () => {
    const files = {
      '/index.ts':
        "import { b } from './b';\nexport const a = 'a';\nconsole.log('index sees', b);\n",
      '/b.ts':
        "import * as index from './index';\nexport const b = 'b';\nconsole.log('b sees', String(index.a));\n",
    };
    await expect(
      runModules(
        { entry: '/index.ts', format: 'esm', modules: project(files, 'esm') },
        nodeIo().io,
      ),
    ).rejects.toThrow('cyclic imports need the CommonJS format');
    const { logs, restore } = captureLogs();
    try {
      await runModules(
        { entry: '/index.ts', format: 'cjs', modules: project(files, 'cjs') },
        nodeIo().io,
      );
    } finally {
      restore();
    }
    // b runs first, while index is still loading: its `a` is hoisted but not yet assigned.
    expect(logs).toEqual(['b sees undefined', 'index sees b']);
  });

  it('supports top-level await in a single-file run', async () => {
    const { logs, restore } = captureLogs();
    try {
      await runModules(
        {
          entry: '/index.ts',
          format: 'esm',
          modules: project(
            {
              '/index.ts':
                'const v = await Promise.resolve(41);\nconsole.log(v + 1);\n',
            },
            'esm',
          ),
        },
        nodeIo().io,
      );
    } finally {
      restore();
    }
    expect(logs).toEqual(['42']);
  });

  it('rejects with the thrown error, whose stack maps to the TypeScript line', async () => {
    const { io, registry } = nodeIo();
    const modules = project(
      {
        '/index.ts':
          "type T = string;\nconst reason: T = 'boom';\nthrow new Error(reason);\n",
      },
      'esm',
    );
    let caught: unknown;
    try {
      await runModules({ entry: '/index.ts', format: 'esm', modules }, io);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('boom');
    expect(registry.locate((caught as Error).stack)).toEqual({
      file: '/index.ts',
      line: 3,
      column: 7,
    });
  });

  it('maps a CommonJS frame through the wrapper offset', async () => {
    const { io, registry } = nodeIo();
    const files = {
      '/index.ts': "import './b';\nexport const a = 1;\n",
      '/b.ts': "import './index';\n\nthrow new Error('in b');\n",
    };
    let caught: unknown;
    try {
      await runModules(
        { entry: '/index.ts', format: 'cjs', modules: project(files, 'cjs') },
        io,
      );
    } catch (error) {
      caught = error;
    }
    expect((caught as Error).message).toBe('in b');
    expect(registry.locate((caught as Error).stack)).toEqual({
      file: '/b.ts',
      line: 3,
      column: 7,
    });
  });

  it('fails when the entry is missing or a require cannot be resolved', async () => {
    await expect(
      runModules(
        { entry: '/nope.ts', format: 'esm', modules: [] },
        nodeIo().io,
      ),
    ).rejects.toThrow('entry /nope.ts is not among the emitted modules');
    const modules = project(
      { '/index.ts': "export const a = require('./missing');\n" },
      'cjs',
    );
    await expect(
      runModules({ entry: '/index.ts', format: 'cjs', modules }, nodeIo().io),
    ).rejects.toThrow(
      "index.ts requires './missing', which is not a file of this project",
    );
  });
});

describe('runModules, the pre-bundled packages (§12 F14)', () => {
  const ZOD_PROJECT = {
    '/index.ts':
      "import { z } from 'zod';\nimport { label } from './label';\nconsole.log(label, z.number().parse(41) + 1);\n",
    '/label.ts': "export const label = 'zod says';\n",
  };

  it('imports zod through the package URL in ESM', async () => {
    const { logs, restore } = captureLogs();
    try {
      await runModules(
        {
          entry: '/index.ts',
          format: 'esm',
          modules: project(ZOD_PROJECT, 'esm'),
        },
        nodeIo().io,
      );
    } finally {
      restore();
    }
    expect(logs).toEqual(['zod says 42']);
  });

  it("require('zod') returns the package in the CommonJS format", async () => {
    const { logs, restore } = captureLogs();
    try {
      await runModules(
        {
          entry: '/index.ts',
          format: 'cjs',
          modules: project(ZOD_PROJECT, 'cjs'),
        },
        nodeIo().io,
      );
    } finally {
      restore();
    }
    expect(logs).toEqual(['zod says 42']);
  });
});

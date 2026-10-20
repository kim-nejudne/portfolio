// The Node sandbox worker through the unchanged runner (§2: both cores run in Node; §12 F6
// criterion 2: solutions are checked "in Node with the same core modules the app uses"): a
// `mode: 'test'` run streams the harness results into the run state, console output and the
// ESM/CJS formats work, and a hanging test is ended by the deadline, as in Chrome.
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { EmittedFile } from '@/protocol/ts-ls';
import { emittedImports } from '@/workers/ts-ls/core';
import type { RunState } from '../runner';
import { createNodeSandboxRunner } from './spawn';

function emit(
  files: Record<string, string>,
  module: 'esm' | 'cjs' = 'esm',
): EmittedFile[] {
  return Object.entries(files).map(([path, text]) => {
    const js = ts.transpileModule(text, {
      fileName: path,
      compilerOptions: {
        target: ts.ScriptTarget.ES2025,
        module:
          module === 'esm' ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        isolatedModules: true,
        inlineSourceMap: true,
        inlineSources: true,
      },
    }).outputText;
    return { path, js, imports: module === 'esm' ? emittedImports(js) : [] };
  });
}

/** Resolves when the runner leaves the running states. */
function settled(
  runner: ReturnType<typeof createNodeSandboxRunner>,
): Promise<RunState> {
  return new Promise((resolve) => {
    const check = (): void => {
      const { kind } = runner.state.status;
      if (
        kind !== 'preparing' &&
        kind !== 'running' &&
        kind !== 'still-running'
      ) {
        unsubscribe();
        resolve(runner.state);
      }
    };
    const unsubscribe = runner.subscribe(check);
    check();
  });
}

describe('the Node sandbox worker', () => {
  it('runs the §5 harness over tests.ts and streams the results into the run state', async () => {
    const runner = createNodeSandboxRunner((paths) =>
      Promise.resolve(
        emit(Object.fromEntries(paths.map((p) => [p, ''])), 'cjs'),
      ),
    );
    const modules = emit({
      '/index.ts': `export function area(side: number): number { return side * side; }
export const label = 'sq';`,
      '/tests.ts': `import { area, label } from './index';
test('squares', () => { expect(area(3)).toBe(9); });
test('wrong', () => { expect(area(2)).toBe(5); });
test('label', () => { expect(label).toContain('q'); console.log('from a test'); });
test.skip('later', () => {});`,
    });
    try {
      await runner.start(modules, '/tests.ts', {
        mode: 'test',
        timeoutMs: 10_000,
      });
      const state = await settled(runner);
      expect(state.status.kind).toBe('done');
      expect(state.tests.map((t) => [t.name, t.status])).toEqual([
        ['squares', 'pass'],
        ['wrong', 'fail'],
        ['label', 'pass'],
        ['later', 'skip'],
      ]);
      expect(state.tests[1]).toMatchObject({
        message: 'expected 4 to be 5',
        expected: '5',
        actual: '4',
      });
      expect(state.testSummary).toMatchObject({
        passed: 2,
        failed: 1,
        timedOut: 0,
        skipped: 1,
      });
      expect(state.entries).toEqual([
        expect.objectContaining({ kind: 'console', text: 'from a test' }),
      ]);
    } finally {
      runner.dispose();
    }
  });

  it('reports a runtime error with its TypeScript line and runs a cycle through CommonJS', async () => {
    const files = {
      '/a.ts': `import { b } from './b';
export const a = 'a';
export function callB(): string { return b(); }`,
      '/b.ts': `import { a } from './a';
export function b(): string { return 'b sees ' + a; }
console.log(b());
throw new Error('late');`,
    };
    const runner = createNodeSandboxRunner(() =>
      Promise.resolve(emit(files, 'cjs')),
    );
    try {
      await runner.start(emit(files), '/b.ts', { timeoutMs: 10_000 });
      const state = await settled(runner);
      expect(state.format).toBe('cjs');
      expect(state.status.kind).toBe('done');
      expect(state.entries[0]).toMatchObject({
        kind: 'console',
        text: 'b sees a',
      });
      expect(state.entries[1]).toMatchObject({
        kind: 'error',
        message: 'Error: late',
        loc: { file: '/b.ts', line: 4 },
      });
    } finally {
      runner.dispose();
    }
  });

  it('is terminated at the deadline when a test spins forever', async () => {
    const runner = createNodeSandboxRunner(() => Promise.resolve([]));
    const modules = emit({
      '/tests.ts': `test('spins', () => { for (;;) {} });`,
    });
    try {
      await runner.start(modules, '/tests.ts', {
        mode: 'test',
        timeoutMs: 300,
      });
      const state = await settled(runner);
      expect(state.status).toEqual({
        kind: 'killed',
        afterMs: 300,
        byDeadline: true,
      });
      expect(state.tests).toEqual([]);
    } finally {
      runner.dispose();
    }
  });
});

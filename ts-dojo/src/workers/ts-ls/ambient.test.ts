// The ambient files the core adds to a project (§5): a project with a tests.ts gets the test
// harness globals and `@dojo/type-utils`, so a tests.ts written as §5 says has zero
// diagnostics; a project without one does not see them.
import { describe, expect, it } from 'vitest';
import {
  AMBIENT_RUNTIME_PATH,
  AMBIENT_TEST_HARNESS_PATH,
  AMBIENT_TYPE_UTILS_PATH,
  needsAmbientTests,
} from './ambient';
import { createTsLsCore } from './core';
import { nodeFetchLib } from './node/fetch-lib';

describe('needsAmbientTests', () => {
  it('is true only when a tests.ts is among the paths', () => {
    expect(needsAmbientTests(['/index.ts', '/tests.ts'])).toBe(true);
    expect(needsAmbientTests(['/index.ts', '/types/x.d.ts'])).toBe(false);
  });
});

describe('a project with a tests.ts', () => {
  it('sees test, expect and @dojo/type-utils with zero diagnostics', async () => {
    const core = createTsLsCore({ fetchLib: nodeFetchLib });
    await core.init();
    await core.openProject({
      files: [
        {
          path: '/index.ts',
          text: `export type Shape = { kind: 'circle'; r: number } | { kind: 'square'; s: number };
export function area(shape: Shape): number {
  return shape.kind === 'circle' ? Math.PI * shape.r ** 2 : shape.s ** 2;
}
export const later = (): Promise<number> => Promise.resolve(1);`,
        },
        {
          path: '/tests.ts',
          text: `import type { Equal, Expect, NotEqual } from '@dojo/type-utils';
import { area, later, type Shape } from './index';

type cases = [
  Expect<Equal<Shape['kind'], 'circle' | 'square'>>,
  Expect<NotEqual<Shape, string>>,
];

test('area', () => {
  expect(area({ kind: 'square', s: 3 })).toBe(9);
  expect(area({ kind: 'circle', r: 1 })).toBeCloseTo(Math.PI, 5);
  expect([1, 2]).toContain(2);
  expect(() => { throw new Error('x'); }).toThrow(/x/);
  expect(new Map()).toBeInstanceOf(Map);
  expect('abc').toHaveLength(3);
  expect(undefined).toBeUndefined();
  expect(null).not.toBeNull();
});

test('async', async () => {
  await expect(later()).resolves.toBe(1);
  await expect(Promise.reject(new Error('no'))).rejects.toBeInstanceOf(Error);
  await expect(later()).resolves.not.toEqual({ a: 1 });
});

test.skip('later', () => undefined);`,
        },
      ],
    });
    expect(core.projectPaths()).toEqual([
      '/index.ts',
      '/tests.ts',
      AMBIENT_RUNTIME_PATH,
      AMBIENT_TEST_HARNESS_PATH,
      AMBIENT_TYPE_UTILS_PATH,
    ]);
    const { diagnostics } = core.getDiagnostics(['/index.ts', '/tests.ts']);
    expect(diagnostics.map((d) => `${String(d.line)}: ${d.message}`)).toEqual(
      [],
    );
    core.dispose();
  });

  it('is the only kind of project that sees them', async () => {
    const core = createTsLsCore({ fetchLib: nodeFetchLib });
    await core.init();
    await core.openProject({
      files: [{ path: '/index.ts', text: 'test("x", () => {});' }],
    });
    expect(core.projectPaths()).toEqual(['/index.ts', AMBIENT_RUNTIME_PATH]);
    const { diagnostics } = core.getDiagnostics(['/index.ts']);
    expect(diagnostics.map((d) => d.code)).toEqual([2593]);
    core.dispose();
  });
});

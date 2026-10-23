// The §5 test harness on a plain global: every matcher, `.not`, `.resolves`/`.rejects`, the
// 1 s timeout, `test.skip`, and the streamed results with expected and actual (§12 F7
// criterion 2 names the UI; this pins the harness the lint and the Tests tab both use).
import { describe, expect as vexpect, it } from 'vitest';
import type { SandboxEvent } from '@/protocol/sandbox';
import { deepEqual, installHarness, MATCHER_NAMES } from './harness';

type TestResult = Extract<SandboxEvent, { type: 'testResult' }>;
type Expect = (value: unknown) => Record<string, unknown>;
type Test = ((name: string, fn: () => void | Promise<void>) => void) & {
  skip: (name: string, fn: () => void | Promise<void>) => void;
};

function setup(testTimeoutMs?: number) {
  const events: SandboxEvent[] = [];
  const global: Record<string, unknown> = {};
  let clock = 0;
  const harness = installHarness({
    global,
    post: (event) => events.push(event),
    now: () => clock,
    ...(testTimeoutMs === undefined ? {} : { testTimeoutMs }),
  });
  const results = () =>
    events.filter((e): e is TestResult => e.type === 'testResult');
  return {
    events,
    harness,
    results,
    test: global['test'] as Test,
    expect: global['expect'] as Expect,
    tick: (ms: number) => (clock += ms),
  };
}

function m(e: Record<string, unknown>, name: string) {
  return e[name] as (...args: unknown[]) => unknown;
}

describe('the matchers', () => {
  it('cover exactly the §5 list', () => {
    vexpect([...MATCHER_NAMES].sort()).toEqual(
      [
        'toBe',
        'toEqual',
        'toBeCloseTo',
        'toThrow',
        'toBeInstanceOf',
        'toContain',
        'toHaveLength',
        'toBeUndefined',
        'toBeNull',
      ].sort(),
    );
  });

  it('pass and fail as their names say', () => {
    const { expect } = setup();
    m(expect(1), 'toBe')(1);
    vexpect(() => m(expect(1), 'toBe')(2)).toThrow('expected 1 to be 2');
    m(
      expect({ a: [1, new Map([['k', 1]])] }),
      'toEqual',
    )({ a: [1, new Map([['k', 1]])] });
    vexpect(() => m(expect({ a: 1 }), 'toEqual')({ a: 1, b: 2 })).toThrow(
      'to equal',
    );
    m(expect(0.1 + 0.2), 'toBeCloseTo')(0.3);
    vexpect(() => m(expect(0.1), 'toBeCloseTo')(0.2)).toThrow('close to');
    m(
      expect(() => {
        throw new Error('boom');
      }),
      'toThrow',
    )('boom');
    m(
      expect(() => {
        throw new Error('boom');
      }),
      'toThrow',
    )(/bo+m/);
    vexpect(() =>
      m(
        expect(() => undefined),
        'toThrow',
      )(),
    ).toThrow('expected the function to throw');
    vexpect(() =>
      m(
        expect(() => {
          throw new Error('other');
        }),
        'toThrow',
      )('boom'),
    ).toThrow('to match');
    m(expect(new Map()), 'toBeInstanceOf')(Map);
    vexpect(() => m(expect(1), 'toBeInstanceOf')(Map)).toThrow(
      'instance of Map',
    );
    m(expect([1, 2]), 'toContain')(2);
    m(expect('hello'), 'toContain')('ell');
    vexpect(() => m(expect([1]), 'toContain')(3)).toThrow('to contain 3');
    m(expect('abc'), 'toHaveLength')(3);
    vexpect(() => m(expect([1]), 'toHaveLength')(2)).toThrow(
      'to have length 2',
    );
    m(expect(undefined), 'toBeUndefined')();
    vexpect(() => m(expect(null), 'toBeUndefined')()).toThrow(
      'to be undefined',
    );
    m(expect(null), 'toBeNull')();
    vexpect(() => m(expect(0), 'toBeNull')()).toThrow('to be null');
  });

  it('`.not` negates, with the message turned around', () => {
    const { expect } = setup();
    const not = (v: unknown) => expect(v)['not'] as Record<string, unknown>;
    m(not(1), 'toBe')(2);
    vexpect(() => m(not(1), 'toBe')(1)).toThrow('expected 1 not to be 1');
    m(not([1]), 'toContain')(2);
    m(
      not(() => undefined),
      'toThrow',
    )();
  });

  it('`.resolves` and `.rejects` await the promise first', async () => {
    const { expect } = setup();
    const resolves = (v: unknown) =>
      expect(v)['resolves'] as Record<string, unknown>;
    const rejects = (v: unknown) =>
      expect(v)['rejects'] as Record<string, unknown>;
    await m(resolves(Promise.resolve(3)), 'toBe')(3);
    await vexpect(
      m(resolves(Promise.resolve(3)), 'toBe')(4) as Promise<void>,
    ).rejects.toThrow('expected 3 to be 4');
    await m(rejects(Promise.reject(new Error('no'))), 'toBeInstanceOf')(Error);
    await vexpect(
      m(rejects(Promise.resolve(1)), 'toBe')(1) as Promise<void>,
    ).rejects.toThrow('expected the promise to reject');
    await vexpect(m(resolves(5), 'toBe')(5) as Promise<void>).rejects.toThrow(
      'expected a promise',
    );
    await m(
      resolves(Promise.resolve(1))['not'] as Record<string, unknown>,
      'toBe',
    )(2);
  });

  it('`.rejects.toThrow(message?)` checks the rejection reason itself, as Jest does (pre-F13)', async () => {
    const { expect } = setup();
    const rejects = (v: unknown) =>
      expect(v)['rejects'] as Record<string, unknown>;
    const rejectsNot = (v: unknown) =>
      rejects(v)['not'] as Record<string, unknown>;
    const timeout = () => Promise.reject(new Error('request timeout'));
    await m(rejects(timeout()), 'toThrow')('timeout');
    await m(rejects(timeout()), 'toThrow')(/^request/);
    await m(rejects(timeout()), 'toThrow')();
    await m(rejects(Promise.reject(new Error(''))), 'toThrow')();
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a reason that is no Error is what this line checks
    await m(rejects(Promise.reject('plain reason')), 'toThrow')('plain');
    // A reason whose message says " to " still negates the right words.
    await vexpect(
      m(
        rejectsNot(Promise.reject(new Error('failed to connect'))),
        'toThrow',
      )('connect') as Promise<void>,
    ).rejects.toThrow(
      "expected the rejection reason's message not to match 'connect', got 'failed to connect'",
    );
    await vexpect(
      m(rejectsNot(timeout()), 'toThrow')() as Promise<void>,
    ).rejects.toThrow('expected the promise not to reject');
    await vexpect(
      m(rejects(timeout()), 'toThrow')('refused') as Promise<void>,
    ).rejects.toThrow(
      "expected the rejection reason's message to match 'refused', got 'request timeout'",
    );
    await m(rejectsNot(timeout()), 'toThrow')('refused');
    await vexpect(
      m(rejectsNot(timeout()), 'toThrow')('timeout') as Promise<void>,
    ).rejects.toThrow(
      "expected the rejection reason's message not to match 'timeout', got 'request timeout'",
    );
    await vexpect(
      m(rejects(Promise.resolve(1)), 'toThrow')('timeout') as Promise<void>,
    ).rejects.toThrow('expected the promise to reject');
    // `.resolves` and the sync form keep calling the received function.
    await vexpect(
      m(
        expect(Promise.resolve('x'))['resolves'] as Record<string, unknown>,
        'toThrow',
      )() as Promise<void>,
    ).rejects.toThrow('expected a function to call');
  });
});

describe('deepEqual', () => {
  it('is structural over arrays, plain objects, Map, Set and Date, and Object.is otherwise', () => {
    vexpect(deepEqual([1, { a: [2] }], [1, { a: [2] }])).toBe(true);
    vexpect(deepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    vexpect(deepEqual(new Date(5), new Date(5))).toBe(true);
    vexpect(deepEqual(new Date(5), new Date(6))).toBe(false);
    vexpect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    vexpect(deepEqual(NaN, NaN)).toBe(true);
    class A {
      x = 1;
    }
    vexpect(deepEqual(new A(), { x: 1 })).toBe(false);
  });
});

describe('running the tests', () => {
  it('streams start, result and summary in order, with expected and actual on a failure', async () => {
    const { test, expect, harness, events, tick } = setup();
    test('adds', () => {
      tick(3);
      m(expect(1 + 1), 'toBe')(2);
    });
    test('fails', () => {
      m(expect({ a: 1 }), 'toEqual')({ a: 2 });
    });
    test('throws', () => {
      throw new Error('plain error');
    });
    test.skip('later', () => undefined);
    vexpect(harness.count()).toBe(4);
    await harness.run();
    vexpect(events.map((e) => e.type)).toEqual([
      'testStart',
      'testResult',
      'testStart',
      'testResult',
      'testStart',
      'testResult',
      'testResult',
      'testSummary',
    ]);
    vexpect(events[1]).toEqual({
      type: 'testResult',
      name: 'adds',
      status: 'pass',
      ms: 3,
    });
    vexpect(events[3]).toEqual({
      type: 'testResult',
      name: 'fails',
      status: 'fail',
      message: 'expected { a: 1 } to equal { a: 2 }',
      expected: '{ a: 2 }',
      actual: '{ a: 1 }',
      ms: 0,
    });
    vexpect(events[5]).toMatchObject({
      name: 'throws',
      status: 'fail',
      message: 'plain error',
    });
    vexpect(events[6]).toEqual({
      type: 'testResult',
      name: 'later',
      status: 'skip',
      ms: 0,
    });
    vexpect(events[7]).toEqual({
      type: 'testSummary',
      passed: 1,
      failed: 2,
      timedOut: 0,
      skipped: 1,
      ms: 3,
    });
  });

  it('awaits async tests and reports a hang as timeout after the limit', async () => {
    const { test, expect, harness, results } = setup(30);
    test('async pass', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      m(expect(true), 'toBe')(true);
    });
    test('hangs', () => new Promise<void>(() => undefined));
    test('after the hang', () => undefined);
    await harness.run();
    vexpect(results().map((r) => [r.name, r.status])).toEqual([
      ['async pass', 'pass'],
      ['hangs', 'timeout'],
      ['after the hang', 'pass'],
    ]);
    vexpect(results()[1]?.message).toBe('timed out after 30 ms');
  });

  it('refuses a test without a name or a function', () => {
    const { test } = setup();
    vexpect(() => (test as unknown as (a: unknown) => void)(1)).toThrow(
      TypeError,
    );
  });
});

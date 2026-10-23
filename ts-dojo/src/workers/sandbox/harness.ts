// The §5 runtime test harness: `test(name, fn)`, `test.skip` and `expect(value)` with the
// matchers §5 lists, defined as globals on the sandbox's global while tests.ts evaluates, then
// run one at a time, each in its own try/catch with a 1 s timeout (`TEST_TIMEOUT_MS`). Every
// result streams out as `testStart`, `testResult` (name, status, message, expected and actual
// serialized like console output, duration) and one `testSummary`. Pure: it installs onto the
// object it is given (`self` in worker.ts, `globalThis` in the Node worker, a plain object in
// harness.test.ts) and posts through an injected function. No test framework runs in the
// browser; this is the whole of it. The declarations tests.ts compiles against are
// AMBIENT_TEST_HARNESS_DTS in src/workers/ts-ls/ambient.ts and must say the same thing.
import {
  TEST_TIMEOUT_MS,
  type SandboxEvent,
  type TestStatus,
} from '@/protocol/sandbox';
import { serialize } from './serialize';

export type TestFn = () => void | Promise<void>;

interface Registered {
  name: string;
  fn: TestFn;
  skip: boolean;
}

export interface HarnessOptions {
  /** The object `test` and `expect` are defined on. */
  global: Record<string, unknown>;
  post: (event: SandboxEvent) => void;
  now?: () => number;
  testTimeoutMs?: number;
}

export interface Harness {
  /** Runs every registered test in order and posts the summary. */
  run(): Promise<void>;
  /** Registered tests so far (skipped ones included). */
  count(): number;
}

/** A failed expectation: the message plus the two sides, already serialized. */
export class ExpectationError extends Error {
  override readonly name = 'ExpectationError';
  readonly expected: string | undefined;
  readonly actual: string | undefined;
  constructor(message: string, expected?: unknown, actual?: unknown) {
    super(message);
    this.expected = expected === undefined ? undefined : serialize(expected);
    this.actual = actual === undefined ? undefined : serialize(actual);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** §5 `toEqual`: structural over arrays, plain objects, Map, Set and Date; Object.is elsewhere. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false;
  }
  if (a instanceof Date || b instanceof Date) {
    return (
      a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
    );
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size)
      return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqual(value, b.get(key))) return false;
    }
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size)
      return false;
    for (const item of a) {
      if (!b.has(item) && ![...b].some((other) => deepEqual(item, other)))
        return false;
    }
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        deepEqual(a[key], b[key]),
    );
  }
  return false;
}

type Check = (received: unknown) => {
  pass: boolean;
  message: string;
  expected?: unknown;
  actual?: unknown;
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const CHECKS: Record<string, (...args: unknown[]) => Check> = {
  toBe: (expected) => (received) => ({
    pass: Object.is(received, expected),
    message: `expected ${serialize(received)} to be ${serialize(expected)}`,
    expected,
    actual: received,
  }),
  toEqual: (expected) => (received) => ({
    pass: deepEqual(received, expected),
    message: `expected ${serialize(received)} to equal ${serialize(expected)}`,
    expected,
    actual: received,
  }),
  toBeCloseTo: (expected, digits) => (received) => {
    const precision = typeof digits === 'number' ? digits : 2;
    const pass =
      typeof received === 'number' &&
      typeof expected === 'number' &&
      (received === expected ||
        Math.abs(received - expected) < 10 ** -precision / 2);
    return {
      pass,
      message: `expected ${serialize(received)} to be close to ${serialize(expected)} (${String(precision)} digits)`,
      expected,
      actual: received,
    };
  },
  toThrow: (wanted) => (received) => {
    if (typeof received !== 'function') {
      return {
        pass: false,
        message: `expected a function to call, received ${serialize(received)}`,
      };
    }
    let thrown: unknown;
    let didThrow = false;
    try {
      (received as () => unknown)();
    } catch (error) {
      didThrow = true;
      thrown = error;
    }
    if (!didThrow) {
      return {
        pass: false,
        message:
          wanted === undefined
            ? 'expected the function to throw'
            : `expected the function to throw ${serialize(wanted)}`,
        expected: wanted,
      };
    }
    const text = messageOf(thrown);
    const matches =
      wanted === undefined
        ? true
        : wanted instanceof RegExp
          ? wanted.test(text)
          : text.includes(
              typeof wanted === 'string' ? wanted : serialize(wanted),
            );
    return {
      pass: matches,
      message: matches
        ? `expected the function not to throw${wanted === undefined ? '' : ` ${serialize(wanted)}`}`
        : `expected the thrown message ${serialize(text)} to match ${serialize(wanted)}`,
      expected: wanted,
      actual: text,
    };
  },
  toBeInstanceOf: (constructor) => (received) => {
    const ctor = constructor as abstract new (...args: never[]) => unknown;
    return {
      pass: typeof ctor === 'function' && received instanceof ctor,
      message: `expected ${serialize(received)} to be an instance of ${typeof ctor === 'function' ? ctor.name : serialize(ctor)}`,
      expected: typeof ctor === 'function' ? ctor.name : ctor,
      actual: received,
    };
  },
  toContain: (item) => (received) => {
    const pass = Array.isArray(received)
      ? received.some((element) => Object.is(element, item))
      : typeof received === 'string' && received.includes(String(item));
    return {
      pass,
      message: `expected ${serialize(received)} to contain ${serialize(item)}`,
      expected: item,
      actual: received,
    };
  },
  toHaveLength: (length) => (received) => {
    const actual =
      received !== null &&
      received !== undefined &&
      typeof (received as { length?: unknown }).length === 'number'
        ? (received as { length: number }).length
        : undefined;
    return {
      pass: actual === length,
      message: `expected ${serialize(received)} to have length ${serialize(length)}`,
      expected: length,
      actual,
    };
  },
  toBeUndefined: () => (received) => ({
    pass: received === undefined,
    message: `expected ${serialize(received)} to be undefined`,
    expected: undefined,
    actual: received,
  }),
  toBeNull: () => (received) => ({
    pass: received === null,
    message: `expected ${serialize(received)} to be null`,
    expected: null,
    actual: received,
  }),
};

export const MATCHER_NAMES: readonly string[] = Object.keys(CHECKS);

function assert(check: Check, received: unknown, negated: boolean): void {
  const result = check(received);
  if (result.pass === negated) {
    const message = negated
      ? result.message.replace(' to ', ' not to ')
      : result.message;
    throw new ExpectationError(message, result.expected, result.actual);
  }
}

/**
 * `.rejects.toThrow(message?)` (pre-F13 fixes, Kim's decision on 23 October 2026): the reason is
 * what was thrown, so it is checked directly, as Jest does. With no argument the rejection
 * itself passes; a string must be in the reason's message, a RegExp must match it.
 */
const toThrowOnRejection =
  (wanted: unknown): Check =>
  (reason) => {
    if (wanted === undefined) {
      return { pass: true, message: 'expected the promise to reject' };
    }
    const text = messageOf(reason);
    const pass =
      wanted instanceof RegExp
        ? wanted.test(text)
        : text.includes(
            typeof wanted === 'string' ? wanted : serialize(wanted),
          );
    return {
      pass,
      // The reason's text comes last: `assert` negates the first " to ".
      message: `expected the rejection reason's message to match ${serialize(wanted)}, got ${serialize(text)}`,
      expected: wanted,
      actual: text,
    };
  };

type Mode = 'sync' | 'resolves' | 'rejects';

function matchers(
  receive: () => unknown,
  negated: boolean,
  mode: Mode,
): Record<string, (...args: unknown[]) => unknown> {
  const out: Record<string, (...args: unknown[]) => unknown> = {};
  for (const [name, make] of Object.entries(CHECKS)) {
    out[name] = (...args: unknown[]) => {
      const check =
        mode === 'rejects' && name === 'toThrow'
          ? toThrowOnRejection(args[0])
          : make(...args);
      if (mode === 'sync') {
        assert(check, receive(), negated);
        return undefined;
      }
      return Promise.resolve(receive()).then((received) => {
        assert(check, received, negated);
      });
    };
  }
  return out;
}

/** `expect(value)`: the matchers, `.not`, `.resolves` and `.rejects` (§5). */
export function expect(received: unknown): Record<string, unknown> {
  const sync = matchers(() => received, false, 'sync');
  const not = matchers(() => received, true, 'sync');
  const resolved = (): Promise<unknown> => {
    if (!isPromiseLike(received)) {
      return Promise.reject(
        new ExpectationError(
          `expected a promise, received ${serialize(received)}`,
        ),
      );
    }
    return Promise.resolve(received);
  };
  const rejection = (): Promise<unknown> => {
    if (!isPromiseLike(received)) {
      return Promise.reject(
        new ExpectationError(
          `expected a promise, received ${serialize(received)}`,
        ),
      );
    }
    return Promise.resolve(received).then(
      (value) => {
        throw new ExpectationError(
          `expected the promise to reject, it resolved with ${serialize(value)}`,
          undefined,
          value,
        );
      },
      (reason: unknown) => reason,
    );
  };
  return {
    ...sync,
    not,
    resolves: {
      ...matchers(resolved, false, 'resolves'),
      not: matchers(resolved, true, 'resolves'),
    },
    rejects: {
      ...matchers(rejection, false, 'rejects'),
      not: matchers(rejection, true, 'rejects'),
    },
  };
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function withTimeout(
  run: () => Promise<void>,
  ms: number,
): Promise<'done' | 'timeout'> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve('timeout'), ms);
    run().then(
      () => {
        clearTimeout(timer);
        resolve('done');
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export function installHarness(options: HarnessOptions): Harness {
  const { global, post } = options;
  const now = options.now ?? (() => Date.now());
  const timeoutMs = options.testTimeoutMs ?? TEST_TIMEOUT_MS;
  const tests: Registered[] = [];
  const register = (skip: boolean) => (name: unknown, fn: unknown) => {
    if (typeof name !== 'string' || typeof fn !== 'function') {
      throw new TypeError('test(name, fn) needs a name and a function');
    }
    tests.push({ name, fn: fn as TestFn, skip });
  };
  const test = Object.assign(register(false), { skip: register(true) });
  Object.defineProperty(global, 'test', {
    value: test,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(global, 'expect', {
    value: expect,
    writable: true,
    configurable: true,
  });

  return {
    count: () => tests.length,
    async run() {
      const started = now();
      const counts = { passed: 0, failed: 0, timedOut: 0, skipped: 0 };
      for (const entry of tests) {
        if (entry.skip) {
          counts.skipped += 1;
          post({ type: 'testResult', name: entry.name, status: 'skip', ms: 0 });
          continue;
        }
        post({ type: 'testStart', name: entry.name });
        const begin = now();
        let status: TestStatus;
        let failure: ExpectationError | Error | null = null;
        try {
          const outcome = await withTimeout(async () => {
            await entry.fn();
          }, timeoutMs);
          status = outcome === 'done' ? 'pass' : 'timeout';
        } catch (error) {
          status = 'fail';
          failure = error instanceof Error ? error : new Error(String(error));
        }
        const ms = now() - begin;
        if (status === 'pass') counts.passed += 1;
        else if (status === 'timeout') counts.timedOut += 1;
        else counts.failed += 1;
        const result: Extract<SandboxEvent, { type: 'testResult' }> = {
          type: 'testResult',
          name: entry.name,
          status,
          ms,
        };
        if (status === 'timeout') {
          result.message = `timed out after ${String(timeoutMs)} ms`;
        } else if (failure !== null) {
          result.message = failure.message;
          if (failure instanceof ExpectationError) {
            if (failure.expected !== undefined)
              result.expected = failure.expected;
            if (failure.actual !== undefined) result.actual = failure.actual;
          }
        }
        post(result);
      }
      post({ type: 'testSummary', ...counts, ms: now() - started });
    },
  };
}

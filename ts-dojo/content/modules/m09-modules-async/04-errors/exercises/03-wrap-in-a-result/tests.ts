import type { Equal, Expect } from '@dojo/type-utils';
import { attempt, settle, toError, type Result } from './index';

function fromNumber() {
  return attempt(() => 42);
}
function fromText() {
  return settle(Promise.resolve('text'));
}

type cases = [
  Expect<Equal<ReturnType<typeof fromNumber>, Result<number, Error>>>, // attempt infers T from fn
  Expect<Equal<ReturnType<typeof fromText>, Promise<Result<string, Error>>>>, // settle resolves to a Result
  Expect<Equal<ReturnType<typeof toError>, Error>>, // toError returns an Error
];

/** The error of a failed Result, or undefined when it succeeded. */
function errorOf<T>(result: Result<T, Error>): Error | undefined {
  return result.ok ? undefined : result.error;
}

function after<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

function rejectAfter(ms: number, reason: unknown): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(reason), ms);
  });
}

const notErrors: unknown[] = [
  'timeout',
  404,
  0,
  null,
  undefined,
  false,
  { code: 7 },
];

test('toError returns an Error of any class unchanged', () => {
  for (const error of [
    new Error('plain'),
    new TypeError('type'),
    new RangeError('range'),
    new SyntaxError('syntax'),
  ]) {
    expect(toError(error)).toBe(error);
  }
});

test('toError wraps any other value, with String(value) as message and the value as cause', () => {
  for (const value of notErrors) {
    const error = toError(value);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(String(value));
    expect(error.cause).toBe(value);
  }
});

test('attempt returns what fn returned, falsy values included', () => {
  for (const value of [42, 0, '', 'text', false, null, undefined, [1, 2]]) {
    expect(attempt(() => value)).toEqual({ ok: true, value });
  }
});

test('attempt calls fn exactly once', () => {
  let calls = 0;
  attempt(() => (calls += 1));
  expect(calls).toBe(1);
  attempt(() => {
    calls += 1;
    throw new Error('once');
  });
  expect(calls).toBe(2);
});

test('attempt returns the Error that fn threw, unchanged', () => {
  for (const text of ['{', '[1,', 'nope']) {
    let thrown: unknown;
    try {
      JSON.parse(text);
    } catch (error) {
      thrown = error;
    }
    const result = attempt(() => JSON.parse(text));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(SyntaxError);
      expect(result.error.message).toBe(
        thrown instanceof Error ? thrown.message : '',
      );
    }
  }
  const error = new RangeError('too far');
  const result = attempt(() => {
    throw error;
  });
  expect(result.ok).toBe(false);
  expect(errorOf(result)).toBe(error);
});

test('attempt wraps a thrown value that is not an Error', () => {
  for (const value of notErrors) {
    const result = attempt(() => {
      throw value;
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe(String(value));
      expect(result.error.cause).toBe(value);
    }
  }
});

test('settle resolves with the value of a promise that fulfils', async () => {
  for (const value of [7, 0, '', 'late', false, null]) {
    await expect(settle(after(2, value))).resolves.toEqual({ ok: true, value });
  }
});

test('settle resolves with the Error of a promise that rejects with one', async () => {
  for (const error of [new TypeError('broken'), new Error('down')]) {
    const result = await settle(rejectAfter(2, error));
    expect(result.ok).toBe(false);
    expect(errorOf(result)).toBe(error);
  }
});

test('settle wraps a rejection reason that is not an Error, and never rejects', async () => {
  for (const value of notErrors) {
    const result = await settle(rejectAfter(1, value));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe(String(value));
      expect(result.error.cause).toBe(value);
    }
  }
});

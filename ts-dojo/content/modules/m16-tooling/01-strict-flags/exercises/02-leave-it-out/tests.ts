import type { Equal, Expect } from '@dojo/type-utils';
import { oneMoreRetry, withTimeout, type RequestOptions } from './index';

type cases = [
  Expect<Equal<RequestOptions, { timeoutMs?: number; retries?: number }>>, // RequestOptions is unchanged
];

// @ts-expect-error
const explicitUndefined: RequestOptions = { timeoutMs: undefined }; // a property set to undefined is still rejected

test('withTimeout sets the timeout', () => {
  expect(withTimeout({}, 500)).toEqual({ timeoutMs: 500 });
  expect(withTimeout({ retries: 2 }, 1000)).toEqual({
    retries: 2,
    timeoutMs: 1000,
  });
  expect(withTimeout({ timeoutMs: 1, retries: 3 }, 250)).toEqual({
    timeoutMs: 250,
    retries: 3,
  });
});

test('withTimeout with undefined leaves the property out', () => {
  const result = withTimeout({ retries: 2 }, undefined);
  expect('timeoutMs' in result).toBe(false);
  expect(Object.keys(result)).toEqual(['retries']);
});

test('withTimeout with undefined removes a timeout that was there', () => {
  const result = withTimeout({ timeoutMs: 500, retries: 1 }, undefined);
  expect('timeoutMs' in result).toBe(false);
  expect(Object.keys(result)).toEqual(['retries']);
});

test('withTimeout does not change its input', () => {
  const options: RequestOptions = { timeoutMs: 500 };
  withTimeout(options, undefined);
  withTimeout(options, 20);
  expect(options).toEqual({ timeoutMs: 500 });
});

test('oneMoreRetry still counts', () => {
  expect(oneMoreRetry({})).toEqual({ retries: 1 });
  expect(oneMoreRetry({ retries: 2, timeoutMs: 5 })).toEqual({
    retries: 3,
    timeoutMs: 5,
  });
});

export { explicitUndefined };

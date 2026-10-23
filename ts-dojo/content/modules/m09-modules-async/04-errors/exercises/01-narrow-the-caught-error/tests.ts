import { HttpError, report } from './index';

function throwing(value: unknown): () => string {
  return () => {
    throw value;
  };
}

test('report passes on what the request returns', () => {
  for (const text of ['home page', '', 'ok', '404']) {
    expect(report(() => text)).toBe(`ok: ${text}`);
  }
});

test('report gives the status and message of an HttpError', () => {
  for (const [status, message] of [
    [404, 'no such page'],
    [500, 'server down'],
    [418, "I'm a teapot"],
    [301, ''],
  ] as const) {
    expect(report(throwing(new HttpError(status, message)))).toBe(
      `HTTP ${status}: ${message}`,
    );
  }
});

test('report gives the message of any other Error', () => {
  expect(report(throwing(new Error('boom')))).toBe('failed: boom');
  expect(report(throwing(new TypeError('not a function')))).toBe(
    'failed: not a function',
  );
  expect(report(throwing(new RangeError('too far')))).toBe('failed: too far');
  expect(report(throwing(new Error('')))).toBe('failed: ');
});

test('report turns a thrown value that is not an Error into a string', () => {
  for (const value of ['timeout', 42, 0, null, undefined, true]) {
    expect(report(throwing(value))).toBe(`failed: ${String(value)}`);
  }
});

test('report does not take a plain object for an error', () => {
  expect(report(throwing({ status: 404, message: 'fake' }))).toBe(
    'failed: [object Object]',
  );
  expect(report(throwing({ message: 'also fake' }))).toBe(
    'failed: [object Object]',
  );
});

test('an HttpError is an Error with its name', () => {
  const error = new HttpError(404, 'gone');
  expect(error).toBeInstanceOf(Error);
  expect(String(error)).toBe('HttpError: gone');
});

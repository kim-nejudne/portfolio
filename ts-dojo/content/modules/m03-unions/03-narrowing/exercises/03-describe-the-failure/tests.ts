import { describeFailure, TimeoutError, type HttpFailure } from './index';

test('a TimeoutError gives how long the request ran', () => {
  expect(describeFailure(new TimeoutError(5000))).toBe('timeout (5000 ms)');
  expect(describeFailure(new TimeoutError(250))).toBe('timeout (250 ms)');
});

test('another Error gives its message', () => {
  expect(describeFailure(new Error('disk full'))).toBe('error: disk full');
});

test('a built-in subclass of Error is an Error too', () => {
  const failure = new TypeError('fetch is not a function');
  expect(describeFailure(failure)).toBe('error: fetch is not a function');
});

test('an HttpFailure gives its status', () => {
  const notFound: HttpFailure = { status: 404, statusText: 'Not Found' };
  expect(describeFailure(notFound)).toBe('HTTP 404 Not Found');
  expect(describeFailure({ status: 503, statusText: 'Unavailable' })).toBe(
    'HTTP 503 Unavailable',
  );
});

test('a string is returned as it is', () => {
  expect(describeFailure('offline')).toBe('offline');
  expect(describeFailure('')).toBe('');
});

test('every kind, over a range of values', () => {
  for (let n = 1; n <= 40; n++) {
    const ms = n * 125;
    const status = 399 + n;
    expect(describeFailure(new TimeoutError(ms))).toBe(`timeout (${ms} ms)`);
    expect(describeFailure(new Error(`failure ${n}`))).toBe(
      `error: failure ${n}`,
    );
    expect(describeFailure({ status, statusText: `reason ${n}` })).toBe(
      `HTTP ${status} reason ${n}`,
    );
    expect(describeFailure(`message ${n}`)).toBe(`message ${n}`);
  }
});

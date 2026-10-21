import type { Equal, Expect } from '@dojo/type-utils';
import { lastSent, retry, sentCount, upload } from './index';

type cases = [
  Expect<Equal<typeof upload.method, 'POST'>>, // upload.method keeps the literal 'POST'
  Expect<Equal<typeof upload.attempts, number>>, // upload.attempts can count up
];

// upload and the list of sent lines live in the module, so the tests build on each other in order.
test('the first retry sends the upload', () => {
  expect(retry()).toBe('POST /photos');
  expect(upload.attempts).toBe(1);
  expect(sentCount()).toBe(1);
  expect(lastSent()).toBe('POST /photos');
});

test('each retry counts and records one more line', () => {
  retry();
  expect(upload.attempts).toBe(2);
  expect(sentCount()).toBe(2);
  expect(lastSent()).toBe('POST /photos');
});

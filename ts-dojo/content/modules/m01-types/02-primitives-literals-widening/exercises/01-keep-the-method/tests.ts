import type { Equal, Expect } from '@dojo/type-utils';
import { line, options } from './index';

type cases = [
  Expect<Equal<typeof options.method, 'GET'>>, // options.method keeps the literal 'GET'
];

test('the request line', () => {
  expect(line).toBe('GET /books');
});

test('the options are unchanged', () => {
  expect(options).toEqual({ url: '/books', method: 'GET' });
});

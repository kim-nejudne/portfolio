import type { Equal, Expect, ExpectValidArgs } from '@dojo/type-utils';
import { tags, title, trim } from './index';

const one = trim(' a ');
const many = trim([' a ', 'b ']);

type cases = [
  Expect<Equal<typeof one, string>>, // a string gives a string
  Expect<Equal<typeof many, string[]>>, // a list gives a list
  Expect<ExpectValidArgs<typeof trim, [string | readonly string[]]>>, // a string or a list is accepted
  Expect<Equal<ReturnType<typeof trim>, string | string[]>>, // a string or a list gives either
];

test('the two lines at the bottom', () => {
  expect(title).toBe('OVERLOADS');
  expect(tags).toBe('ts,overloads');
});

test('trims a string', () => {
  expect(trim('  padded\t')).toBe('padded');
  expect(trim('none')).toBe('none');
});

test('trims every string in a list', () => {
  expect(trim([' a', 'b ', ' c '])).toEqual(['a', 'b', 'c']);
  expect(trim([])).toEqual([]);
});

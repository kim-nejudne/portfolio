import type { Equal, Expect } from '@dojo/type-utils';
import { oneOf } from './index';

declare const query: string;
const size = () => oneOf(['s', 'm', 'l'], 'm', query);
const mode = () => oneOf(['light', 'dark'], 'dark', query);
const anyOptions = <K extends string>(options: readonly K[], fallback: K) =>
  oneOf(options, fallback, query);

type cases = [
  Expect<Equal<ReturnType<typeof size>, 's' | 'm' | 'l'>>, // the options decide the type
  Expect<Equal<ReturnType<typeof mode>, 'light' | 'dark'>>, // other options, another type
  Expect<Equal<ReturnType<typeof anyOptions<'x' | 'y'>>, 'x' | 'y'>>, // any options at all
];

// @ts-expect-error
const tooBig = () => oneOf(['s', 'm', 'l'], 'xl', query); // a fallback outside the options

// @ts-expect-error
const typo = () => oneOf(['light', 'dark'], 'drak', query); // a misspelt fallback

export { size, mode, anyOptions, tooBig, typo };

test('returns the input when it is an option', () => {
  expect(oneOf(['s', 'm', 'l'], 'm', 'l')).toBe('l');
  expect(oneOf(['s', 'm', 'l'], 'm', 's')).toBe('s');
  expect(oneOf(['light', 'dark'], 'dark', 'light')).toBe('light');
});

test('returns the fallback otherwise', () => {
  expect(oneOf(['s', 'm', 'l'], 'm', 'xl')).toBe('m');
  expect(oneOf(['s', 'm', 'l'], 'l', '')).toBe('l');
  expect(oneOf(['light', 'dark'], 'dark', 'Light')).toBe('dark');
});

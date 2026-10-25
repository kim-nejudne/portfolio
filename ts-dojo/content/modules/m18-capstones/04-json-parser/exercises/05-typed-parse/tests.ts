import type { Equal, Expect } from '@dojo/type-utils';
import { parse } from './index';

const fromInput: string = '{"n": 1}';
const broken: string = '[1,';
const port = 8080;

// Never called: the calls are here for their types.
const config = () =>
  parse('{"port": 8080, "tags": ["a", "b"], "debug": false}');
const list = () => parse('[1, [2, 3], null]');
const scalar = () => parse(' "hi" ');
const fromString = () => parse(fromInput);
const built = () => parse(`{"port": ${port}}`);

type cases = [
  Expect<
    Equal<
      ReturnType<typeof config>,
      { port: 8080; tags: ['a', 'b']; debug: false }
    >
  >, // an object
  Expect<Equal<ReturnType<typeof list>, [1, [2, 3], null]>>, // an array
  Expect<Equal<ReturnType<typeof scalar>, 'hi'>>, // a string
  Expect<Equal<ReturnType<typeof fromString>, unknown>>, // a plain string
  Expect<Equal<ReturnType<typeof built>, { port: 8080 }>>, // a template with a constant in it
];

// @ts-expect-error
const trailingComma = () => parse('[1, 2,]'); // a literal that isn't JSON

// @ts-expect-error
const unclosed = () => parse('{"a": 1'); // an object that isn't closed

export { config, list, scalar, fromString, built, trailingComma, unclosed };

test('parses literal text', () => {
  expect(parse('{"port": 8080, "tags": ["a", "b"], "debug": false}')).toEqual({
    port: 8080,
    tags: ['a', 'b'],
    debug: false,
  });
  expect(parse('[1, [2, 3], null]')).toEqual([1, [2, 3], null]);
  expect(parse(' "hi" ')).toBe('hi');
});

test('parses text known only at run time', () => {
  const ports: string = `[${port}, ${port + 1}]`;
  expect(parse(fromInput)).toEqual({ n: 1 });
  expect(parse(ports)).toEqual([8080, 8081]);
});

test('throws on bad text known only at run time', () => {
  expect(() => parse(broken)).toThrow();
});

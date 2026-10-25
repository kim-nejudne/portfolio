import type { Equal, Expect } from '@dojo/type-utils';
import { arrayOf, loadScores, parseJson, toScore, type Decoder } from './index';

const toWord: Decoder<string> = (value) => {
  if (typeof value !== 'string') {
    throw new Error(`expected a word, got ${JSON.stringify(value)}`);
  }
  return value;
};

const scores = parseJson('[90, 85]', arrayOf(toScore));
const words = parseJson('["a", "b"]', arrayOf(toWord));
const grid = parseJson('[[1], [2, 3]]', arrayOf(arrayOf(toScore)));

type cases = [
  Expect<Equal<typeof parseJson, <T>(text: string, decode: Decoder<T>) => T>>, // parseJson takes a decoder and returns what it returns
  Expect<Equal<typeof arrayOf, <T>(item: Decoder<T>) => Decoder<T[]>>>, // arrayOf turns an item decoder into an array decoder
  Expect<Equal<typeof toScore, Decoder<number>>>, // toScore decodes a number
  Expect<Equal<typeof loadScores, (text: string) => number[]>>, // loadScores returns the scores
  Expect<Equal<typeof scores, number[]>>, // T is inferred from the decoder
  Expect<Equal<typeof words, string[]>>, // for any item type
  Expect<Equal<typeof grid, number[][]>>, // and for arrays of arrays
];

// @ts-expect-error
const noDecoder = () => parseJson<number[]>('[1]'); // a decoder is required

test('toScore accepts every integer from 0 to 100', () => {
  for (let score = 0; score <= 100; score++) {
    expect(toScore(score)).toBe(score);
  }
});

test('toScore rejects what is not a score', () => {
  for (const value of [
    -1,
    101,
    1000,
    2.5,
    99.9,
    '50',
    null,
    undefined,
    [],
    {},
  ]) {
    expect(() => toScore(value)).toThrow('expected a score');
  }
});

test('arrayOf decodes every item, for arrays of many lengths', () => {
  for (let length = 0; length <= 8; length++) {
    const values = Array.from({ length }, (_, i) => (i * 13) % 101);
    expect(arrayOf(toScore)(values)).toEqual(values);
  }
  expect(scores).toEqual([90, 85]);
  expect(words).toEqual(['a', 'b']);
  expect(grid).toEqual([[1], [2, 3]]);
});

test('arrayOf returns what the item decoder returns', () => {
  const lengths = arrayOf((value) => String(value).length);
  expect(lengths(['tea', 'coffee', 12345])).toEqual([3, 6, 5]);
  const decoded = arrayOf((value) => ({ value }))([1, 'b']);
  expect(decoded).toEqual([{ value: 1 }, { value: 'b' }]);
});

test('arrayOf returns a new array', () => {
  const values = [1, 2, 3];
  const decoded = arrayOf(toScore)(values);
  expect(decoded).toEqual(values);
  expect(decoded === values).toBe(false);
});

test('arrayOf rejects what is not an array', () => {
  for (const value of [{}, 'abc', 3, null, undefined, { length: 1 }]) {
    expect(() => arrayOf(toScore)(value)).toThrow('expected an array');
  }
});

test('arrayOf throws the item decoder error for a bad item', () => {
  expect(() => arrayOf(toScore)([90, '85'])).toThrow('expected a score');
  expect(() => arrayOf(toWord)(['a', 2])).toThrow('expected a word');
  expect(() => arrayOf(arrayOf(toScore))([[1], 2])).toThrow(
    'expected an array',
  );
});

test('loadScores reads a file of scores', () => {
  expect(loadScores('[90, 85, 100, 0]')).toEqual([90, 85, 100, 0]);
  expect(loadScores('[]')).toEqual([]);
});

test('loadScores throws for a malformed file', () => {
  expect(() => loadScores('[90, "85"]')).toThrow('expected a score');
  expect(() => loadScores('[90, 101]')).toThrow('expected a score');
  expect(() => loadScores('{"scores": [90]}')).toThrow('expected an array');
  expect(() => loadScores('{}')).toThrow('expected an array');
});

test('parseJson returns what the decoder returns', () => {
  expect(parseJson('[1, 2]', (value) => String(value))).toBe('1,2');
  expect(() => parseJson('"90"', toScore)).toThrow('expected a score');
  for (let i = 0; i < 5; i++) {
    expect(parseJson(`{"n": ${i}}`, (value) => [value, i])).toEqual([
      { n: i },
      i,
    ]);
  }
});

import type { Equal, Expect } from '@dojo/type-utils';
import {
  findFirst,
  formatEntry,
  lengths,
  longest,
  mapAll,
  sortBy,
} from './index';

type Player = { name: string; level: number };

const players: Player[] = [
  { name: 'Grace', level: 7 },
  { name: 'Ada', level: 9 },
  { name: 'Hedy', level: 3 },
];

const labels = mapAll([1, 2], (n) => `#${n}`);
const strong = findFirst(players, (player) => player.level > 5);

type cases = [
  Expect<
    Equal<typeof mapAll, <T, U>(items: readonly T[], fn: (item: T) => U) => U[]>
  >, // mapAll needs only T and U
  Expect<
    Equal<
      typeof findFirst,
      <T>(items: readonly T[], test: (item: T) => boolean) => T | undefined
    >
  >, // findFirst needs only T
  Expect<Equal<typeof sortBy, <T>(items: readonly T[], key: keyof T) => T[]>>, // sortBy needs only T
  Expect<Equal<typeof formatEntry, (label: string, value: unknown) => string>>, // formatEntry needs no type parameter
  Expect<Equal<typeof lengths, number[]>>, // the lengths are numbers
  Expect<Equal<typeof labels, string[]>>, // U is inferred from the callback
  Expect<Equal<typeof strong, Player | undefined>>, // findFirst returns an item
];

// @ts-expect-error
sortBy(players, 'rank'); // a player has no rank

// @ts-expect-error
findFirst(players, (player) => player.rank > 1); // the test's item is a Player

test('lengths and the longest', () => {
  expect(lengths).toEqual([3, 6, 5]);
  expect(longest).toBe(6);
});

test('mapAll calls fn on every item, for lists of many lengths', () => {
  for (let length = 0; length <= 6; length++) {
    const numbers = Array.from({ length }, (_, i) => i);
    expect(mapAll(numbers, (n) => n * 3)).toEqual(numbers.map((n) => n * 3));
    expect(mapAll(numbers, (n) => `#${n}`)).toEqual(
      numbers.map((n) => `#${n}`),
    );
  }
});

test('findFirst returns the first item that passes', () => {
  expect(strong).toBe(players[0]);
  expect(findFirst(players, (player) => player.level > 8)).toBe(players[1]);
  expect(findFirst(players, (player) => player.level > 10)).toBeUndefined();
  for (let limit = 0; limit < 10; limit++) {
    const numbers = [4, 1, 8, 3, 9, 2];
    expect(findFirst(numbers, (n) => n > limit)).toBe(
      numbers.find((n) => n > limit),
    );
  }
});

test('sortBy sorts a copy by the property it is given', () => {
  expect(sortBy(players, 'name').map((player) => player.name)).toEqual([
    'Ada',
    'Grace',
    'Hedy',
  ]);
  expect(sortBy(players, 'level').map((player) => player.level)).toEqual([
    3, 7, 9,
  ]);
  expect(players.map((player) => player.name)).toEqual([
    'Grace',
    'Ada',
    'Hedy',
  ]);
});

test('formatEntry writes the label and the value as JSON', () => {
  expect(formatEntry('port', 8080)).toBe('port=8080');
  expect(formatEntry('host', 'localhost')).toBe('host="localhost"');
  expect(formatEntry('tags', ['a', 'b'])).toBe('tags=["a","b"]');
  for (let i = 0; i < 5; i++) {
    expect(formatEntry(`k${i}`, { i })).toBe(`k${i}={"i":${i}}`);
  }
});

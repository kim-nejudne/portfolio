import type { Equal, Expect } from '@dojo/type-utils';
import { groupBy } from './index';

type Player = { name: string; team: string; age: number };

const ada: Player = { name: 'Ada', team: 'red', age: 36 };
const grace: Player = { name: 'Grace', team: 'blue', age: 85 };
const hedy: Player = { name: 'Hedy', team: 'red', age: 41 };
const alan: Player = { name: 'Alan', team: 'green', age: 41 };
const players: readonly Player[] = [ada, grace, hedy, alan];

const byTeam = groupBy(players, (player) => player.team);
const byInitial = groupBy(['apple', 'avocado', 'banana'], (word) => word[0]);

type cases = [
  Expect<Equal<typeof byTeam, Record<string, Player[]>>>, // players grouped are still players
  Expect<Equal<typeof byInitial, Record<string, string[]>>>, // the groups follow the list's item type
  Expect<Equal<ReturnType<typeof groupBy<number>>, Record<string, number[]>>>, // one type parameter, for the items
];

// @ts-expect-error
const byAge = groupBy(players, (player) => player.age); // the key must be a string

// @ts-expect-error
const byNickname = groupBy(players, (player) => player.nickname); // the callback sees a Player

test('groups players by team, in list order', () => {
  expect(byTeam).toEqual({ red: [ada, hedy], blue: [grace], green: [alan] });
  expect(byTeam.red[0]).toBe(ada);
  expect(byTeam.red[1]).toBe(hedy);
});

test('groups words by their first letter', () => {
  expect(byInitial).toEqual({ a: ['apple', 'avocado'], b: ['banana'] });
});

test('keys appear in the order they are first seen', () => {
  expect(Object.keys(byTeam)).toEqual(['red', 'blue', 'green']);
});

test('groups numbers by remainder, for lists of many lengths', () => {
  for (let length = 0; length <= 12; length++) {
    const numbers = Array.from({ length }, (_, i) => i);
    const groups = groupBy(numbers, (n) => `r${n % 3}`);
    const expected: Record<string, number[]> = {};
    for (const n of numbers) {
      (expected[`r${n % 3}`] ??= []).push(n);
    }
    expect(groups).toEqual(expected);
  }
});

test('an empty list gives an empty object', () => {
  expect(groupBy([], () => 'any')).toEqual({});
});

test('returns a new object each time and leaves the list alone', () => {
  const words = ['one', 'two', 'three'];
  const first = groupBy(words, (word) => word);
  const second = groupBy(words, (word) => word);
  expect(first).not.toBe(second);
  first.one.push('changed');
  expect(second.one).toEqual(['one']);
  expect(words).toEqual(['one', 'two', 'three']);
});

export { byAge, byNickname };

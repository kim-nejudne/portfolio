import type { Equal, Expect } from '@dojo/type-utils';
import { groupBy } from './index';

type Player = { name: string; team: string; level: number; active: boolean };

const ada: Player = { name: 'Ada', team: 'red', level: 3, active: true };
const bo: Player = { name: 'Bo', team: 'blue', level: 1, active: false };
const cy: Player = { name: 'Cy', team: 'red', level: 1, active: true };
const players: readonly Player[] = [ada, bo, cy];

const byTeam = groupBy(players, 'team');
const byLevel = groupBy(players, 'level');
const byActive = groupBy(players, 'active');

type cases = [
  Expect<Equal<typeof byTeam, Map<string, Player[]>>>, // keys of a string property are strings
  Expect<Equal<typeof byLevel, Map<number, Player[]>>>, // keys of a number property are numbers
  Expect<Equal<typeof byActive, Map<boolean, Player[]>>>, // keys of a boolean property are booleans
];

// @ts-expect-error
groupBy(players, 'score'); // a player has no score

// @ts-expect-error
groupBy(players, 'Team'); // property names are case-sensitive

test('groups by a string property', () => {
  expect([...byTeam.entries()]).toEqual([
    ['red', [ada, cy]],
    ['blue', [bo]],
  ]);
});

test('groups by a number property', () => {
  expect([...byLevel.entries()]).toEqual([
    [3, [ada]],
    [1, [bo, cy]],
  ]);
});

test('groups by a boolean property', () => {
  expect([...byActive.entries()]).toEqual([
    [true, [ada, cy]],
    [false, [bo]],
  ]);
});

test('the groups hold the items themselves', () => {
  const red = byTeam.get('red');
  expect(red?.[0]).toBe(ada);
  expect(red?.[1]).toBe(cy);
});

test('groups many items by the property that was asked for', () => {
  const many: Player[] = [];
  for (let i = 0; i < 30; i++) {
    many.push({
      name: `p${i}`,
      team: ['red', 'blue', 'green'][i % 3] ?? 'none',
      level: i % 4,
      active: i % 5 === 0,
    });
  }
  const teams = groupBy(many, 'team');
  expect([...teams.keys()]).toEqual(['red', 'blue', 'green']);
  expect(teams.get('green')).toEqual(many.filter((_, i) => i % 3 === 2));
  const levels = groupBy(many, 'level');
  expect([...levels.keys()]).toEqual([0, 1, 2, 3]);
  for (let level = 0; level < 4; level++) {
    expect(levels.get(level)).toEqual(many.filter((p) => p.level === level));
  }
  const names = groupBy(many, 'name');
  expect(names.size).toBe(30);
});

test('an empty list gives an empty map', () => {
  expect(groupBy([], 'team').size).toBe(0);
});

test('leaves the list alone', () => {
  const list: Player[] = [cy, bo, ada];
  groupBy(list, 'team');
  expect(list).toEqual([cy, bo, ada]);
});

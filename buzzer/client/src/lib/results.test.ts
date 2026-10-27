import { describe, expect, it } from 'vitest';
import { PLAYER_PALETTE } from '../../../shared/constants.js';
import type { RankedPlayer } from '../../../shared/types.js';
import { ordinal, podiumSteps, replayOrder, signedPoints } from './results.js';

function player(id: string, score: number, rank: number): RankedPlayer {
  return { id, name: id, color: PLAYER_PALETTE[0], score, connected: true, rank };
}

const ids = (players: readonly RankedPlayer[]) => players.map((p) => p.id);

describe('ordinal', () => {
  it('uses st, nd, rd and th, with 11th to 13th as exceptions', () => {
    const cases: [number, string][] = [
      [1, '1st'],
      [2, '2nd'],
      [3, '3rd'],
      [4, '4th'],
      [11, '11th'],
      [12, '12th'],
      [13, '13th'],
      [21, '21st'],
      [22, '22nd'],
      [50, '50th'],
      [101, '101st'],
      [111, '111th'],
    ];
    for (const [n, text] of cases) expect(ordinal(n)).toBe(text);
  });
});

describe('signedPoints', () => {
  it('signs gains and losses with plus and minus signs', () => {
    expect(signedPoints(100)).toBe('+100');
    expect(signedPoints(-100)).toBe('−100');
    expect(signedPoints(0)).toBe('0');
  });
});

describe('podiumSteps', () => {
  it('puts first in the middle, second on the left and third on the right', () => {
    const steps = podiumSteps([player('a', 300, 1), player('b', 200, 2), player('c', 100, 3)]);
    expect(steps.map((s) => [s.rank, s.height, ids(s.players)])).toEqual([
      [2, 1, ['b']],
      [1, 0, ['a']],
      [3, 2, ['c']],
    ]);
  });

  it('leaves off everyone ranked below 3rd', () => {
    const steps = podiumSteps([
      player('a', 400, 1),
      player('b', 300, 2),
      player('c', 200, 3),
      player('d', 100, 4),
    ]);
    expect(steps.flatMap((s) => ids(s.players))).not.toContain('d');
  });

  it('ties share a podium rank: two firsts share the top step and the next is 3rd', () => {
    const steps = podiumSteps([
      player('a', 300, 1),
      player('b', 300, 1),
      player('c', 100, 3),
      player('d', 50, 4),
    ]);
    expect(steps.map((s) => [s.rank, s.height, ids(s.players)])).toEqual([
      [3, 1, ['c']],
      [1, 0, ['a', 'b']],
    ]);
  });

  it('a tie for second shares the second step', () => {
    const steps = podiumSteps([player('a', 300, 1), player('b', 200, 2), player('c', 200, 2)]);
    expect(steps.map((s) => [s.rank, ids(s.players)])).toEqual([
      [2, ['b', 'c']],
      [1, ['a']],
    ]);
  });

  it('a single player gets the top step alone, and no players give no steps', () => {
    expect(podiumSteps([player('a', 0, 1)]).map((s) => [s.rank, s.height])).toEqual([[1, 0]]);
    expect(podiumSteps([])).toEqual([]);
  });
});

describe('replayOrder', () => {
  const now = [player('b', 300, 1), player('a', 200, 2), player('c', 100, 3)];

  it('keeps the order the scoreboard was last shown in', () => {
    expect(ids(replayOrder(['a', 'b', 'c'], now))).toEqual(['a', 'b', 'c']);
  });

  it('adds players who joined since at the end, in the current ranking', () => {
    const later = [...now, player('e', 50, 4), player('d', 0, 5)];
    expect(ids(replayOrder(['a', 'b', 'c'], later))).toEqual(['a', 'b', 'c', 'e', 'd']);
  });

  it('drops players who have left, and shows them with their current scores', () => {
    const order = replayOrder(['x', 'a', 'b', 'c'], now);
    expect(ids(order)).toEqual(['a', 'b', 'c']);
    expect(order[0]?.score).toBe(200);
  });

  it('with no earlier order, is the current ranking', () => {
    expect(ids(replayOrder([], now))).toEqual(['b', 'a', 'c']);
  });
});

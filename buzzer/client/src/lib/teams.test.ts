import { describe, expect, it } from 'vitest';
import { TEAMS } from '../../../shared/constants.js';
import type { TeamView } from '../../../shared/types.js';
import { teamOf, teamsByRank } from './teams.js';

function team(index: number, score: number, rank: number, memberIds: string[] = []): TeamView {
  return { index, ...TEAMS[index]!, score, rank, memberIds };
}

describe('teamOf', () => {
  const teams = [team(0, 0, 1, ['p1', 'p3']), team(1, 0, 1, ['p2'])];

  it('finds the team listing the player', () => {
    expect(teamOf(teams, 'p3')?.name).toBe('Red');
    expect(teamOf(teams, 'p2')?.name).toBe('Blue');
  });

  it('is null with teams off or for a player on no team', () => {
    expect(teamOf(null, 'p1')).toBeNull();
    expect(teamOf(teams, 'p9')).toBeNull();
  });
});

describe('teamsByRank', () => {
  it('sorts best first, tied teams in index order, without changing the input', () => {
    const teams = [team(0, 100, 2), team(1, 300, 1), team(2, 0, 4), team(3, 100, 2)];
    expect(teamsByRank(teams).map((t) => t.name)).toEqual(['Blue', 'Red', 'Yellow', 'Green']);
    expect(teams.map((t) => t.index)).toEqual([0, 1, 2, 3]);
  });
});

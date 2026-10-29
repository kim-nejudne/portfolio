import type { TeamView } from '../../../shared/types.js';

/** The team listing `playerId`, or null with teams off or for a player on none. */
export function teamOf(teams: readonly TeamView[] | null, playerId: string): TeamView | null {
  return teams?.find((team) => team.memberIds.includes(playerId)) ?? null;
}

/**
 * The teams best first, by the server's rank; tied teams keep index order, as `rankTeams` lists
 * them (DECISIONS, F81). The views send teams in index order so columns stay still.
 */
export function teamsByRank(teams: readonly TeamView[]): TeamView[] {
  return [...teams].sort((a, b) => a.rank - b.rank || a.index - b.index);
}

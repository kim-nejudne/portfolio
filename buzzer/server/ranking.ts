/** What ranking reads: players, and session totals mapped to the same shape (F76). */
interface Scored {
  score: number;
  joinedAt: number;
}

/** What team ranking reads: a team's index into `TEAMS` and its summed score (F81). */
interface ScoredTeam {
  index: number;
  score: number;
}

export type Ranked<P> = P & { rank: number };

/**
 * Sorts by score, highest first; ties are listed in join order. Equal scores share a rank and
 * the next score skips the ranks they fill (200, 200, 100 → 1, 1, 3). Does not mutate `players`.
 */
export function rankPlayers<P extends Scored>(players: readonly P[]): Ranked<P>[] {
  return ranked(players, (a, b) => a.joinedAt - b.joinedAt);
}

/** Ranks teams as `rankPlayers` ranks players; tied teams are listed by index. */
export function rankTeams<T extends ScoredTeam>(teams: readonly T[]): Ranked<T>[] {
  return ranked(teams, (a, b) => a.index - b.index);
}

function ranked<T extends { score: number }>(
  items: readonly T[],
  tieOrder: (a: T, b: T) => number,
): Ranked<T>[] {
  const sorted = [...items].sort((a, b) => b.score - a.score || tieOrder(a, b));
  let rank = 0;
  let previous: number | undefined;
  return sorted.map((item, i) => {
    if (item.score !== previous) rank = i + 1;
    previous = item.score;
    return { ...item, rank };
  });
}

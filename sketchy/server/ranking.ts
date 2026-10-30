// Shared ranks for SCOREBOARD and FINAL. Ported from Buzzr (buzzer/server/ranking.ts), players
// only: Sketchy has no teams.

/** What ranking reads: a player's game total and when they joined. */
interface Scored {
  score: number;
  joinedAt: number;
}

export type Ranked<P> = P & { rank: number };

/**
 * Sorts by score, highest first; ties are listed in join order. Equal scores share a rank and
 * the next score skips the ranks they fill (200, 200, 100 → 1, 1, 3). Does not mutate `players`.
 */
export function rankPlayers<P extends Scored>(players: readonly P[]): Ranked<P>[] {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
  let rank = 0;
  let previous: number | undefined;
  return sorted.map((player, i) => {
    if (player.score !== previous) rank = i + 1;
    previous = player.score;
    return { ...player, rank };
  });
}

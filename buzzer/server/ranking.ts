import type { Player } from '../shared/types.js';

export type Ranked<P extends Player> = P & { rank: number };

/**
 * Sorts by score, highest first; ties are listed in join order. Equal scores share a rank and
 * the next score skips the ranks they fill (200, 200, 100 → 1, 1, 3). Does not mutate `players`.
 */
export function rankPlayers<P extends Player>(players: readonly P[]): Ranked<P>[] {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
  let rank = 0;
  let previous: number | undefined;
  return sorted.map((player, i) => {
    if (player.score !== previous) rank = i + 1;
    previous = player.score;
    return { ...player, rank };
  });
}

// A cycle's turn order (Turn order in docs/spec.md): every player in join order, begun after a
// given join time for a game started by Rematch. Shared by the reducer and the views' "Jun draws
// first" during the rematch countdown.

import type { Player } from '../shared/types.js';

/**
 * The pids of `players` in join order. With `after` set (the last game's first drawer's
 * `joinedAt`), the order begins at the first player who joined later, wrapping to the earliest
 * joiner, so each rematch moves the first drawer on by one, even when that drawer has left.
 */
export function cycleOrder(
  players: readonly Pick<Player, 'pid' | 'joinedAt'>[],
  after: number | null,
): string[] {
  const sorted = [...players].sort((x, y) => x.joinedAt - y.joinedAt);
  const from = after === null ? -1 : sorted.findIndex((p) => p.joinedAt > after);
  const at = from === -1 ? 0 : from;
  return [...sorted.slice(at), ...sorted.slice(0, at)].map((p) => p.pid);
}

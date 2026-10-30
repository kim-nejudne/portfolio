// Display helpers for the Screen. Presentation only: the server decides everything else.

import type { PlayerChipView } from '../../../shared/types.js';

/**
 * Letters per word in a mask (`_` hidden, a hint letter as itself), for the `(5, 4)` after the
 * blanks. Words are split on spaces; hyphens and punctuation don't count as letters.
 */
export function wordLengths(mask: readonly string[]): number[] {
  return mask
    .join('')
    .split(' ')
    .map((word) => [...word].filter((ch) => ch === '_' || /[\p{L}\p{N}]/u.test(ch)).length)
    .filter((n) => n > 0);
}

/** The hint letters a mask shows, in word order, for screen readers. */
export function hintLetters(mask: readonly string[]): string[] {
  return mask.filter((ch) => /[\p{L}\p{N}]/u.test(ch));
}

/** Time left as `m:ss`, rounded up, so the clock reads 0:00 only when time is up. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export interface RankedPlayer {
  player: PlayerChipView;
  rank: number;
}

/**
 * Players in the server's shared-rank order (1, 2, 2, 4), ties in join order (the view's order).
 * Only for SCOREBOARD and FINAL, where every chip carries a rank (DECISIONS 43); display only, the
 * server ranks. A chip without one would sort last rather than break the list.
 */
export function rankPlayers(players: readonly PlayerChipView[]): RankedPlayer[] {
  return players
    .map((player) => ({ player, rank: player.rank ?? players.length }))
    .sort((a, b) => a.rank - b.rank);
}

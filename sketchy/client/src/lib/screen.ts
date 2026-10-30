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
 * Players by score, highest first, with shared ranks (1, 2, 2, 4); ties keep join order. Only for
 * SCOREBOARD and FINAL, where views carry scores.
 */
// SPEC-QUESTION: ScreenView has no ranks; the Screen sorts the scores it is sent (DECISIONS 25).
export function rankPlayers(players: readonly PlayerChipView[]): RankedPlayer[] {
  const score = (p: PlayerChipView) => p.score ?? 0;
  return [...players]
    .sort((a, b) => score(b) - score(a))
    .map((player, _i, sorted) => ({
      player,
      rank: 1 + sorted.filter((p) => score(p) > score(player)).length,
    }));
}

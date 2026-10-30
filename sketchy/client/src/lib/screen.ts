// Display helpers for the Screen. Presentation only: the server decides everything else.

import type { PlayerChipView, ScreenView, TurnView } from '../../../shared/types.js';
import type { CopyKey, Translate } from './copy.js';

/** The Screen's two layouts (UI by role and phase, Screen). */
export type ScreenLayout = 'landscape' | 'portrait';

/** At or below this width/height the Screen is portrait. */
export const PORTRAIT_MAX_RATIO = 0.85;

/**
 * Which layout a Screen of this size gets: portrait at a width/height of 0.85 or less, landscape
 * otherwise. Near-square Screens (between 0.85 and 1.2) take the landscape layout, whose sidebar is
 * at its 28 % minimum there. A window with no size yet counts as landscape.
 */
export function screenLayout(width: number, height: number): ScreenLayout {
  if (width <= 0 || height <= 0) return 'landscape';
  return width / height <= PORTRAIT_MAX_RATIO ? 'portrait' : 'landscape';
}

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

/**
 * The lobby's How to play strip (Screen, Lobby): three steps of at most six words, each with an
 * icon. The icons are decoration; the step text carries the meaning.
 */
export const HOW_TO_PLAY: readonly { icon: string; key: CopyKey }[] = [
  { icon: '✏️', key: 'howToDraw' },
  { icon: '📱', key: 'howToGuess' },
  { icon: '⚡', key: 'howToScore' },
];

/**
 * Whether the turn keeps a row under the drawing for the caption: the game's first two turns, in
 * CHOOSING and REVEAL too (empty there), so the drawing doesn't change size at the reveal.
 */
export function hasCaptionRow(turn: Pick<TurnView, 'number'>): boolean {
  return turn.number <= 2;
}

/**
 * The caption under the drawing in the first two turns of every game (Screen, Drawing), which
 * teaches that guesses are typed, not said. `turn.number` counts the game's drawn turns, so a turn
 * skipped before a word was chosen doesn't use one up. DRAWING only: "Mika is drawing" would be
 * wrong while she is still choosing, and the reveal has its own panel.
 */
export function turnCaption(view: Pick<ScreenView, 'phase' | 'turn'>, t: Translate): string | null {
  if (view.phase !== 'DRAWING' || !view.turn || !hasCaptionRow(view.turn)) return null;
  if (view.turn.number === 1) return t('captionFirstTurn', { name: view.turn.drawerName });
  if (view.turn.number === 2) return t('captionSecondTurn');
  return null;
}

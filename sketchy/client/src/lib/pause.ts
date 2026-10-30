// The paused overlay's words (Pausing in docs/spec.md): one line for why, then the 3-2-1.
import type { PausedView, PauseReason } from '../../../shared/types.js';
import type { CopyKey, Translate } from './copy.js';

/** The reason shown when several hold the game: whatever the room is waiting on comes first. */
const ORDER: readonly PauseReason[] = ['drawerAway', 'screenAway', 'fewPlayers', 'host'];

const LINE: Record<PauseReason, CopyKey> = {
  drawerAway: 'pausedDrawerAway',
  screenAway: 'pausedScreenAway',
  fewPlayers: 'pausedFewPlayers',
  host: 'pausedByHost',
};

/** "Waiting for Mika's phone…" and the like; null during the 3-2-1, which has no reason left. */
export function pauseLine(
  paused: PausedView,
  drawerName: string | null,
  t: Translate,
): string | null {
  const reason = ORDER.find((r) => paused.reasons.includes(r));
  return reason ? t(LINE[reason], { name: drawerName ?? '' }) : null;
}

/** The 3-2-1's digit for the time left: 3 for 3000–2001 ms … 1 down to 0. */
export function countdownDigit(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

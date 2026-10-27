import type { PlayerView } from '../../../shared/types.js';

/** How the buzzer looks: grey, bright and pulsing, pressed in, green, or dim. */
export type BuzzerKind = 'idle' | 'live' | 'pressed' | 'won' | 'lost';

export interface BuzzerState {
  kind: BuzzerKind;
  label: string;
  /** True when a press sends `player:buzz`. */
  live: boolean;
}

/**
 * The buzzer's look and label for this player (UI spec, Player view). `pressed` is the local
 * press for the current opening, shown before the server's next snapshot arrives.
 */
export function buzzerState(view: PlayerView, pressed: boolean): BuzzerState {
  switch (view.phase) {
    case 'LOBBY':
      return idle('You’re in! Waiting for the host');
    case 'QUESTION':
      return idle('Get ready…');
    case 'OPEN':
    case 'COLLECTING':
      // TODO(F24): the locked-out state.
      if (view.lockedOut) return idle('Game in progress');
      if (pressed || view.hasBuzzed) return { kind: 'pressed', label: 'Buzzed…', live: false };
      return { kind: 'live', label: 'BUZZ!', live: true };
    case 'BUZZED':
      if (view.winnerId === view.me.id) {
        return { kind: 'won', label: 'You’re first! Answer now', live: false };
      }
      return { kind: 'lost', label: `${view.winnerName ?? 'Someone'} buzzed first`, live: false };
    default:
      // TODO(F24): the answer at REVEAL and the final rank in FINAL.
      return idle('Game in progress');
  }
}

function idle(label: string): BuzzerState {
  return { kind: 'idle', label, live: false };
}

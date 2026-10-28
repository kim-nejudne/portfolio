import type { PlayerView } from '../../../shared/types.js';
import { ordinal, signedPoints } from './results.js';
import { TIME_UP_LABEL, type AnswerCountdown } from './useAnswerCountdown.js';

/**
 * How the buzzer looks: grey, bright and pulsing, pressed in, green, dim, dark with an X, grey
 * with the answer, or the final result in place of the button.
 */
export type BuzzerKind =
  'idle' | 'live' | 'pressed' | 'won' | 'lost' | 'out' | 'revealed' | 'final';

export interface BuzzerState {
  kind: BuzzerKind;
  label: string;
  /** A second line: the points scored at reveal, or the final score. */
  detail?: string;
  /** The winner's seconds left to answer, while an answer time runs. */
  secondsLeft?: number;
  /** True when a press sends `player:buzz`. */
  live: boolean;
}

/**
 * The buzzer's look and label for this player (UI spec, Player view). `pressed` is the local
 * press for the current opening, shown before the server's next snapshot arrives. `countdown` is
 * the answer countdown from `useAnswerCountdown`; only the winner's phone shows it.
 */
export function buzzerState(
  view: PlayerView,
  pressed: boolean,
  countdown: AnswerCountdown | null = null,
): BuzzerState {
  switch (view.phase) {
    case 'LOBBY':
      return idle('You’re in! Waiting for the host');
    case 'QUESTION':
      return idle('Get ready…');
    case 'OPEN':
    case 'COLLECTING':
      if (view.lockedOut) return lockedOut();
      if (pressed || view.hasBuzzed) return { kind: 'pressed', label: 'Buzzed…', live: false };
      return { kind: 'live', label: 'BUZZ!', live: true };
    case 'BUZZED':
      // A wrong answer stays BUZZED until the buzzers reopen (DECISIONS #5): the judged winner is
      // already locked out then, and so is anyone judged wrong earlier in the question.
      if (view.lockedOut) return lockedOut();
      if (view.winnerId === view.me.id) {
        if (countdown?.up) return { kind: 'won', label: TIME_UP_LABEL, live: false };
        return {
          kind: 'won',
          label: 'You’re first! Answer now',
          ...(countdown && { secondsLeft: countdown.secondsLeft }),
          live: false,
        };
      }
      return { kind: 'lost', label: `${view.winnerName ?? 'Someone'} buzzed first`, live: false };
    case 'REVEAL':
      return {
        kind: 'revealed',
        // SPEC-QUESTION: a penalty shows as "−100", like "+100" for a score (DECISIONS, F24).
        label: view.answer ?? 'Answer revealed',
        ...(view.pointsThisQuestion !== 0 && { detail: signedPoints(view.pointsThisQuestion) }),
        live: false,
      };
    case 'FINAL':
      return {
        kind: 'final',
        label: `${ordinal(view.me.rank)} of ${view.playerCount}`,
        detail: `${view.me.score} ${Math.abs(view.me.score) === 1 ? 'point' : 'points'}`,
        live: false,
      };
  }
}

function idle(label: string): BuzzerState {
  return { kind: 'idle', label, live: false };
}

function lockedOut(): BuzzerState {
  return { kind: 'out', label: 'Locked out this round', live: false };
}

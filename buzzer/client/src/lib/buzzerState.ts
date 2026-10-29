import type { PlayerView } from '../../../shared/types.js';
import { ordinal, signedPoints } from './results.js';
import { TIME_UP_LABEL, type AnswerCountdown } from './useAnswerCountdown.js';

/** A player who joined while the buzzers were open waits for the next opening (UI spec, Player view). */
export const LATE_JOINER_LABEL = 'Get ready… you can buzz from the next question';

/** The phone's label for a false start, until the wait after the opening ends (UI spec, Player view). */
export const TOO_EARLY_LABEL = 'Too early!';

/**
 * How the buzzer looks: grey, a muted test buzzer in the lobby, amber after a false start, bright and pulsing, pressed in,
 * the winner's red panel, dim, muted with a red X, the answer in a card, or the final result in
 * place of the button. The label is the status line above the button; the button itself always
 * reads BUZZ.
 */
export type BuzzerKind =
  | 'idle'
  | 'practice'
  | 'early'
  | 'live'
  | 'pressed'
  | 'won'
  | 'lost'
  | 'out'
  | 'revealed'
  | 'final';

export interface BuzzerState {
  kind: BuzzerKind;
  label: string;
  /** A second line: the points scored at reveal, or the final score. */
  detail?: string;
  /** The winner's seconds left to answer, while an answer time runs. */
  secondsLeft?: number;
  /** True when a press sends `player:buzz`. A `practice` press sends `player:practice` instead. */
  live: boolean;
}

/**
 * The buzzer's look and label for this player (UI spec, Player view). `pressed` is the local
 * press for the current opening, shown before the server's next snapshot arrives. `countdown` is
 * the answer countdown from `useAnswerCountdown`; only the winner's phone shows it. `held` is
 * `useFalseStartWait`: this player pressed early and the wait after the opening has not ended.
 */
export function buzzerState(
  view: PlayerView,
  pressed: boolean,
  countdown: AnswerCountdown | null = null,
  held = false,
): BuzzerState {
  switch (view.phase) {
    case 'LOBBY':
      // A test buzz: the server answers it with `fx practice` only (DECISIONS F59).
      return { kind: 'practice', label: 'Tap to test your buzzer', live: false };
    case 'QUESTION':
      // With false starts on, the grey button still takes a press: the server records it (F71).
      if (view.falseStartMs === 0) return idle('Get ready…');
      if (pressed || view.falseStart) return tooEarly();
      return { kind: 'idle', label: 'Get ready…', live: true };
    case 'OPEN':
    case 'COLLECTING':
      if (view.lockedOut) return lockedOut();
      // The server ignores this player's presses until the wait ends, so none is sent (F71).
      if (view.falseStart && held) return tooEarly();
      if (pressed || view.hasBuzzed) return { kind: 'pressed', label: 'Buzzed…', live: false };
      // Joined during this opening: a press could not count, so none is sent (DECISIONS F39).
      if (!view.canBuzz) return idle(LATE_JOINER_LABEL);
      return { kind: 'live', label: 'Buzzers open!', live: true };
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

function tooEarly(): BuzzerState {
  return { kind: 'early', label: TOO_EARLY_LABEL, live: false };
}

function lockedOut(): BuzzerState {
  return { kind: 'out', label: 'Locked out this round', live: false };
}

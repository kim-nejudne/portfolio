import type { PlayerView } from '../../../shared/types.js';
import { ordinal, pointsLabel, signedPoints } from './results.js';
import { TIME_UP_LABEL, type AnswerCountdown } from './useAnswerCountdown.js';

/** A player who joined while the buzzers were open waits for the next opening (UI spec, Player view). */
export const LATE_JOINER_LABEL = 'Get ready… you can buzz from the next question';

/** The phone's label for a false start, until the wait after the opening ends (UI spec, Player view). */
export const TOO_EARLY_LABEL = 'Too early!';

/** The phone's label once its pick or typed answer is in (UI spec, Player view). */
export const ANSWER_SENT_LABEL = 'Answer sent';

/**
 * How the buzzer looks: grey, a muted test buzzer in the lobby, amber after a false start, bright and pulsing, pressed in,
 * the winner's red panel, dim, muted with a red X, the answer in a card, or the final result in
 * place of the button. The label is the status line above the button; the button itself always
 * reads BUZZ. `choice` is a choice question taking answers: the choice buttons replace the buzzer.
 * `typed` is a typed question taking answers, or locked and waiting for the host: a text box does.
 */
export type BuzzerKind =
  | 'idle'
  | 'choice'
  | 'typed'
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
  /** The small heading over the reveal card, when it is not "Answer". */
  caption?: string;
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
 * `picked` is this player's choice on a choice question: the local tap before the server's `mine`.
 */
export function buzzerState(
  view: PlayerView,
  pressed: boolean,
  countdown: AnswerCountdown | null = null,
  held = false,
  picked: number | null = view.choice?.mine ?? null,
): BuzzerState {
  switch (view.phase) {
    case 'LOBBY':
      // A test buzz: the server answers it with `fx practice` only (DECISIONS F59).
      return { kind: 'practice', label: 'Tap to test your buzzer', live: false };
    case 'BOARD':
      // The host is picking the next tile; the phone waits as before a question (DECISIONS F89).
      return idle('Get ready…');
    case 'QUESTION':
      // A choice or typed question has no buzzer, so no false start either (DECISIONS, F85).
      if (view.choice || view.typed) return idle('Get ready…');
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
    case 'ANSWERING':
      // A typed answer can change until the answers lock; then the room waits for the host (F87).
      if (view.typed) {
        const { mine, closed } = view.typed;
        return {
          kind: 'typed',
          label: mine !== null ? ANSWER_SENT_LABEL : closed ? 'Answers closed' : 'Type your answer',
          live: false,
        };
      }
      // The pick can still change until the answering closes (DECISIONS, F85).
      return {
        kind: 'choice',
        label: picked === null ? 'Pick your answer' : ANSWER_SENT_LABEL,
        live: false,
      };
    case 'REVEAL':
      if (gotItRight(view)) {
        return {
          kind: 'revealed',
          caption: 'Your answer',
          label: 'Correct!',
          ...(view.pointsThisQuestion !== 0 && { detail: signedPoints(view.pointsThisQuestion) }),
          live: false,
        };
      }
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
        detail: pointsLabel(view.me.score),
        live: false,
      };
  }
}

/** This player's choice or typed answer was right, by the REVEAL view's correct choice or groups. */
export function gotItRight({ choice, typed, me }: PlayerView): boolean {
  if (choice) return choice.mine !== null && choice.mine === choice.correctChoice;
  return !!typed?.groups?.some((group) => group.correct && group.playerIds.includes(me.id));
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

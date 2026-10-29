import type { PlayerView } from '../../../shared/types.js';
import { pointsText, rankText, translator, type Translate } from './copy.js';
import { signedPoints } from './results.js';
import type { AnswerCountdown } from './useAnswerCountdown.js';

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
  // The room's language (F91): every label below comes from the copy table.
  const t = translator(view.copy);
  const idle = (label: string): BuzzerState => ({ kind: 'idle', label, live: false });
  const tooEarly = (): BuzzerState => ({ kind: 'early', label: t('tooEarly'), live: false });
  const lockedOut = (): BuzzerState => ({ kind: 'out', label: t('lockedOutRound'), live: false });
  switch (view.phase) {
    case 'LOBBY':
      // A test buzz: the server answers it with `fx practice` only (DECISIONS F59).
      return { kind: 'practice', label: t('tapToTest'), live: false };
    case 'BOARD':
      // The host is picking the next tile; the phone waits as before a question (DECISIONS F89).
      return idle(t('getReady'));
    case 'QUESTION':
      // A choice or typed question has no buzzer, so no false start either (DECISIONS, F85).
      if (view.choice || view.typed) return idle(t('getReady'));
      // With false starts on, the grey button still takes a press: the server records it (F71).
      if (view.falseStartMs === 0) return idle(t('getReady'));
      if (pressed || view.falseStart) return tooEarly();
      return { kind: 'idle', label: t('getReady'), live: true };
    case 'OPEN':
    case 'COLLECTING':
      if (view.lockedOut) return lockedOut();
      // The server ignores this player's presses until the wait ends, so none is sent (F71).
      if (view.falseStart && held) return tooEarly();
      if (pressed || view.hasBuzzed) return { kind: 'pressed', label: t('buzzed'), live: false };
      // Joined during this opening: a press could not count, so none is sent (DECISIONS F39).
      if (!view.canBuzz) return idle(t('lateJoiner'));
      return { kind: 'live', label: t('buzzersOpenPhone'), live: true };
    case 'BUZZED':
      // A wrong answer stays BUZZED until the buzzers reopen (DECISIONS #5): the judged winner is
      // already locked out then, and so is anyone judged wrong earlier in the question.
      if (view.lockedOut) return lockedOut();
      if (view.winnerId === view.me.id) {
        if (countdown?.up) return { kind: 'won', label: t('timeUp'), live: false };
        return {
          kind: 'won',
          label: t('youreFirst'),
          ...(countdown && { secondsLeft: countdown.secondsLeft }),
          live: false,
        };
      }
      return { kind: 'lost', label: lostLabel(t, view.winnerName), live: false };
    case 'ANSWERING':
      // A typed answer can change until the answers lock; then the room waits for the host (F87).
      if (view.typed) {
        const { mine, closed } = view.typed;
        return {
          kind: 'typed',
          label:
            mine !== null ? t('answerSent') : closed ? t('answersClosed') : t('typeYourAnswer'),
          live: false,
        };
      }
      // The pick can still change until the answering closes (DECISIONS, F85).
      return {
        kind: 'choice',
        label: picked === null ? t('pickYourAnswer') : t('answerSent'),
        live: false,
      };
    case 'REVEAL':
      if (gotItRight(view)) {
        return {
          kind: 'revealed',
          caption: t('yourAnswer'),
          label: t('correct'),
          ...(view.pointsThisQuestion !== 0 && { detail: signedPoints(view.pointsThisQuestion) }),
          live: false,
        };
      }
      return {
        kind: 'revealed',
        // SPEC-QUESTION: a penalty shows as "−100", like "+100" for a score (DECISIONS, F24).
        label: view.answer ?? t('answerRevealed'),
        ...(view.pointsThisQuestion !== 0 && { detail: signedPoints(view.pointsThisQuestion) }),
        live: false,
      };
    case 'FINAL':
      return {
        kind: 'final',
        label: rankText(t, view.me.rank, view.playerCount),
        detail: pointsText(t, view.me.score),
        live: false,
      };
  }
}

/** This player's choice or typed answer was right, by the REVEAL view's correct choice or groups. */
export function gotItRight({ choice, typed, me }: PlayerView): boolean {
  if (choice) return choice.mine !== null && choice.mine === choice.correctChoice;
  return !!typed?.groups?.some((group) => group.correct && group.playerIds.includes(me.id));
}

/** "Ana buzzed first", or "Someone buzzed first" when the winner has left. */
function lostLabel(t: Translate, winnerName: string | null): string {
  return winnerName === null ? t('someoneBuzzedFirst') : t('buzzedFirst', { name: winnerName });
}

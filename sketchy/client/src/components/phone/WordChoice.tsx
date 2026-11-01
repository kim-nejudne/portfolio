import { useEffect, useRef, useState } from 'react';
import type { Ack, ChoiceIndex, ChoiceView, PlayerView } from '../../../../shared/types.js';
import type { CopyKey, Translate } from '../../lib/copy.js';
import { useCountdown } from '../../lib/useCountdown.js';
import { CountdownRing } from '../sketch/CountdownRing.js';
import { Tape } from '../sketch/Tape.js';

interface Props {
  view: PlayerView;
  receivedAt: number;
  /** Sends `drawer:choose`; the next `state` (DRAWING) takes the phone on. */
  onChoose: (index: ChoiceIndex) => Promise<Ack | null>;
  /** The next drawer choosing during REVEAL or SCOREBOARD (F21): "You draw next! Pick a word". */
  next?: boolean;
  t: Translate;
}

/** Taps this soon after the cards appear are ignored: a tap meant for the screen before. */
export const CHOICE_ARM_MS = 400;
/** Longer for the next drawer's cards, which replace the guess box mid-typing at the reveal. */
export const NEXT_CHOICE_ARM_MS = 700;

const LEVEL: Record<ChoiceView['difficulty'], CopyKey> = {
  1: 'levelEasy',
  2: 'levelMedium',
  3: 'levelHard',
};

/**
 * The drawer's phone in CHOOSING, and the next drawer's during REVEAL and SCOREBOARD (UI by role
 * and phase, Drawer phone; Sketchbook Drawer): the heading, "Hold your phone close 🤫" and the 12 s
 * countdown ring, then three ruled index cards, easiest first, taped on top, each with its red-pen
 * level tag and the word large (unlike the small word in the drawing bar). The server auto-picks
 * the easiest when the time runs out; the phone only sends the tap.
 */
export function WordChoice({ view, receivedAt, onChoose, next = false, t }: Props) {
  const choices = view.secret?.choices ?? [];
  // CHOOSING shows the turn's clock; the next drawer's choice has its own (F21).
  const timer = (next ? view.secret?.chooseTimer : view.turn?.timer) ?? null;
  const left = useCountdown(timer, receivedAt);
  // The tapped card, until the server answers: no second tap meanwhile.
  const [sent, setSent] = useState<ChoiceIndex | null>(null);
  const armed = useRef(false);
  useEffect(() => {
    const id = setTimeout(() => (armed.current = true), next ? NEXT_CHOICE_ARM_MS : CHOICE_ARM_MS);
    return () => clearTimeout(id);
    // Armed once per mount: the same cards stay armed when REVEAL hands over to CHOOSING.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (index: ChoiceIndex) => {
    if (sent !== null || !armed.current) return;
    setSent(index);
    void onChoose(index).then((res) => {
      // Refused or lost: tap again (on success the next `state` moves the phone on).
      if (!res?.ok) setSent(null);
    });
  };

  return (
    <div className="flex h-full flex-col gap-3 px-4 pt-1 pb-3 select-none">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[clamp(1.5rem,8vw,1.875rem)] leading-[1.05]">
            {t(next ? 'youDrawNext' : 'yourTurnToDraw')}
          </h2>
          <p className="text-base text-soft">{t('holdPhoneClose')}</p>
        </div>
        {timer && (
          <span role="timer" aria-label={t('seconds', { n: Math.ceil(left / 1000) })}>
            <CountdownRing remainingMs={left} totalMs={timer.totalMs} choosing size="58px" />
          </span>
        )}
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-3.5 pt-1">
        {choices.map((choice, i) => {
          const index = i as ChoiceIndex;
          return (
            // The tape sits on the card's top edge, outside the button, so the button can clip.
            <li key={index} className="relative flex max-h-48 min-h-0 flex-1">
              <Tape place="top" />
              <button
                type="button"
                onClick={() => choose(index)}
                disabled={sent !== null}
                aria-pressed={sent === index}
                className={`index-card relative flex min-h-16 w-full flex-col justify-start overflow-hidden rounded-[4px] border-2 border-ink px-4 pt-5 pb-2 text-left text-ink shadow-[3px_3px_0_var(--color-ink)] transition-colors ${
                  sent === index
                    ? 'bg-hl'
                    : sent !== null
                      ? 'bg-canvas opacity-50'
                      : 'bg-canvas active:bg-hl'
                }`}
              >
                <span className="min-w-0 shrink-0 text-[clamp(1.625rem,9vw,2.125rem)] leading-[1.1] break-words">
                  {/* Keeps the first line clear of the level tag; a long word's next lines get the
                      card's full width. */}
                  <span aria-hidden className="float-right h-5 w-[4.5rem]" />
                  {choice.word}
                </span>
                {/* The red-pen level tag, written in the card's top-right corner. */}
                <span className="absolute top-2.5 right-3 rounded-[10px_4px_10px_4px] border-2 border-red px-[7px] text-[15px] leading-5 text-red">
                  {t(choice.custom ? 'levelOurs' : LEVEL[choice.difficulty])}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-center text-base leading-tight text-soft">{t('tapOne')}</p>
    </div>
  );
}

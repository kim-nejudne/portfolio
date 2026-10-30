import { useEffect, useRef, useState } from 'react';
import type { Ack, ChoiceIndex, ChoiceView, PlayerView } from '../../../../shared/types.js';
import type { CopyKey, Translate } from '../../lib/copy.js';
import { useCountdown } from '../../lib/useCountdown.js';

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
 * and phase, Drawer phone): three word cards, easiest
 * first, each with its level and gloss, the 12 s countdown and "Hold your phone close 🤫". The
 * words are large here, unlike the small word in the drawing bar. The server auto-picks the
 * easiest when the time runs out; the phone only sends the tap.
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
    <div className="flex h-full flex-col gap-2 px-4 pt-3 pb-3 select-none">
      <p className="flex items-baseline justify-between gap-3 text-xl font-bold">
        <span>{t(next ? 'youDrawNext' : 'yourTurnToDraw')}</span>
        {timer && (
          <span role="timer" className={`tabular-nums ${left <= 3_000 ? 'text-[#FF8F5E]' : ''}`}>
            <span aria-hidden>◔</span> {t('seconds', { n: Math.ceil(left / 1000) })}
          </span>
        )}
      </p>
      <p className="text-base text-[#FFD166]">{t('holdPhoneClose')}</p>
      <ul className="flex min-h-0 flex-1 flex-col gap-2">
        {choices.map((choice, i) => {
          const index = i as ChoiceIndex;
          return (
            <li key={index} className="flex max-h-48 min-h-0 flex-1">
              <button
                type="button"
                onClick={() => choose(index)}
                disabled={sent !== null}
                aria-pressed={sent === index}
                className={`flex min-h-16 w-full flex-col justify-center gap-1 overflow-hidden rounded-2xl px-4 py-2 text-left text-[#1D1B22] transition-colors ${
                  sent === index
                    ? 'bg-[#FFD166]'
                    : sent !== null
                      ? 'bg-white/40'
                      : 'bg-white active:bg-[#FFD166]'
                }`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-[clamp(1.25rem,7vw,1.75rem)] leading-tight font-bold break-words">
                    {choice.word}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-[#1D1B22]">
                    {t(LEVEL[choice.difficulty])}
                  </span>
                </span>
                {choice.gloss && (
                  <span className="line-clamp-2 text-base leading-snug text-[#1D1B22]/80">
                    {choice.gloss}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-center text-sm text-white/70">{t('tapOne')}</p>
    </div>
  );
}

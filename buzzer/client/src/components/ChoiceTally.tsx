import { CHOICE_COLORS, CHOICE_LETTERS } from '../../../shared/constants.js';
import type { HostChoiceView, Phase } from '../../../shared/types.js';
import { LABEL } from '../lib/ui.js';
import { Icon } from './Icon.js';

interface ChoiceTallyProps {
  choice: HostChoiceView;
  phase: Phase;
  /** Mark the correct choice. The read-aloud layout covers the answer, so it waits for REVEAL. */
  showCorrect: boolean;
}

/**
 * A choice question on the remote (F86): "N of M answered" while answers come in, and each choice
 * with its letter, colour, text and how many picked it, as a bar of everyone who answered. The host
 * view always carries the correct choice and the counts (DECISIONS, F85).
 */
export function ChoiceTally({ choice, phase, showCorrect }: ChoiceTallyProps) {
  const taking = phase === 'ANSWERING' || phase === 'REVEAL';
  const total = choice.counts.reduce((sum, count) => sum + count, 0);
  return (
    <section
      aria-label="Answers"
      className="flex flex-col gap-2.5 rounded-[20px] border-2 border-edge bg-surface p-4"
    >
      <p className={`flex justify-between gap-2 ${LABEL}`}>
        <span>Answers</span>
        {taking && (
          <span role="status" className="shrink-0 whitespace-nowrap">
            {choice.answered} of {choice.expected} answered
          </span>
        )}
      </p>
      <ol className="flex flex-col gap-2">
        {choice.choices.map((text, index) => {
          const count = choice.counts[index] ?? 0;
          const correct = showCorrect && index === choice.correctChoice;
          return (
            <li
              key={index}
              data-correct={correct || undefined}
              className={`relative flex items-center gap-3 overflow-hidden rounded-xl border-2 bg-bg px-3 py-2 ${
                correct ? 'border-win' : 'border-transparent'
              }`}
            >
              {/* The share of answers, behind the row. */}
              <span
                aria-hidden="true"
                data-bar
                style={{
                  width: `${total > 0 ? (count / total) * 100 : 0}%`,
                  backgroundColor: CHOICE_COLORS[index],
                }}
                className="absolute inset-y-0 left-0 opacity-25 transition-[width]"
              />
              <span
                style={{ backgroundColor: CHOICE_COLORS[index] }}
                className="relative grid size-8 shrink-0 place-items-center rounded-full font-display text-lg text-bg"
              >
                {CHOICE_LETTERS[index]}
              </span>
              <span className="relative min-w-0 flex-1 font-bold break-words">{text}</span>
              {correct && (
                <>
                  <span className="sr-only">, correct</span>
                  <Icon name="check" className="relative size-5 shrink-0 text-win" />
                </>
              )}
              <span
                data-count
                className="relative min-w-6 shrink-0 text-right font-display text-xl tabular-nums"
              >
                {count}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { MAX_QUESTIONS_PER_SET } from '../../../shared/constants.js';
import { type PastedQuestion, parsePaste, pasteRoom } from '../lib/bulkPaste.js';
import { QUESTION_CAP_MESSAGE } from '../lib/setEditor.js';
import { BUTTON_PRIMARY_SMALL, BUTTON_SMALL, CARD, FIELD } from '../lib/ui.js';

interface PasteQuestionsProps {
  /** How many questions the set holds now. */
  count: number;
  onAdd: (questions: PastedQuestion[]) => void;
  onCancel: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * **Paste questions**: a text area read line by line, a preview of what it found and why any line
 * was skipped, and **Add N questions** for the good ones that fit within the set's limit. It opens
 * under the editor's toolbar and scrolls into view; from `md` the text and the result sit side by
 * side, and both lists grow with the page rather than scrolling inside it (EDT-07).
 */
export function PasteQuestions({ count, onAdd, onCancel }: PasteQuestionsProps) {
  const [text, setText] = useState('');
  const { questions, bad } = parsePaste(text);
  const room = pasteRoom(count);
  const adding = questions.slice(0, room);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  return (
    <section
      ref={ref}
      aria-labelledby="paste-heading"
      className={`${CARD} flex scroll-mt-28 flex-col gap-3 p-4 md:p-5`}
    >
      <h2 id="paste-heading" className="font-display text-2xl">
        Paste questions
      </h2>
      <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start">
        <div className="flex flex-col gap-2">
          <p id="paste-help" className="text-muted">
            One question per line: <code className="text-ink">Question | Answer | points</code>. Or
            paste cells from a spreadsheet, with columns in that order: a paste with any tab is read
            as cells. Points are optional (100).
          </p>
          <label htmlFor="paste-text" className="sr-only">
            Questions to paste
          </label>
          <textarea
            id="paste-text"
            rows={8}
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-describedby="paste-help"
            placeholder="Capital of France? | Paris | 200"
            className={FIELD}
          />
        </div>

        <div className="flex flex-col gap-3">
          {questions.length === 0 && bad.length === 0 && (
            <p className="hidden text-muted md:block">What the paste finds shows here.</p>
          )}
          {questions.length > 0 && (
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold">{plural(questions.length, 'question')} found</h3>
              <ol aria-label="Questions found" className="flex flex-col gap-1">
                {questions.map((question) => (
                  <li key={question.line} className="rounded-lg bg-bg px-3 py-1">
                    <span className="break-words">{question.text}</span>{' '}
                    <span className="text-muted">
                      · {question.answer} · {question.points} pts
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {bad.length > 0 && (
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-buzz">{plural(bad.length, 'line')} skipped</h3>
              <ul aria-label="Lines skipped" className="flex flex-col gap-1">
                {bad.map((line) => (
                  <li key={line.line} className="rounded-lg bg-bg px-3 py-1">
                    <span className="font-semibold">Line {line.line}:</span>{' '}
                    {line.reasons.join(' ')}
                    <span className="block truncate text-muted">{line.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {questions.length > room && (
            <p className="text-muted">
              {room === 0
                ? QUESTION_CAP_MESSAGE
                : `Only ${plural(room, 'more question')} fit: a set holds up to ${MAX_QUESTIONS_PER_SET}.`}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onAdd(adding)}
          disabled={adding.length === 0}
          className={`${BUTTON_PRIMARY_SMALL} text-lg`}
        >
          Add {plural(adding.length, 'question')}
        </button>
        <button type="button" onClick={onCancel} className={BUTTON_SMALL}>
          Cancel
        </button>
      </div>
    </section>
  );
}

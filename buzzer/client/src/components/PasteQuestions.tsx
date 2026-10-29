import { useState } from 'react';
import { MAX_QUESTIONS_PER_SET } from '../../../shared/constants.js';
import { type PastedQuestion, parsePaste, pasteRoom } from '../lib/bulkPaste.js';
import { HOVER } from '../lib/hover.js';
import { QUESTION_CAP_MESSAGE } from '../lib/setEditor.js';

const button = `min-h-11 rounded-xl border-2 border-edge bg-surface px-3 py-2 text-base font-bold transition not-disabled:active:scale-95 disabled:opacity-40 ${HOVER}`;

interface PasteQuestionsProps {
  /** How many questions the set holds now. */
  count: number;
  onAdd: (questions: PastedQuestion[]) => void;
  onCancel: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * **Paste questions**: a text area read line by line, a preview of what it found and why any line
 * was skipped, and **Add N questions** for the good ones that fit within the set's limit.
 */
export function PasteQuestions({ count, onAdd, onCancel }: PasteQuestionsProps) {
  const [text, setText] = useState('');
  const { questions, bad } = parsePaste(text);
  const room = pasteRoom(count);
  const adding = questions.slice(0, room);

  return (
    <section
      aria-labelledby="paste-heading"
      className="flex w-full flex-col gap-3 rounded-[20px] border-2 border-edge bg-surface p-4"
    >
      <h2 id="paste-heading" className="font-display text-2xl">
        Paste questions
      </h2>
      <p id="paste-help" className="text-muted">
        One question per line: <code className="text-ink">Question | Answer | points</code>. Or
        paste cells from a spreadsheet, with columns in that order: a paste with any tab is read as
        cells. Points are optional (100).
      </p>
      <label htmlFor="paste-text" className="sr-only">
        Questions to paste
      </label>
      <textarea
        id="paste-text"
        rows={6}
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-describedby="paste-help"
        placeholder="Capital of France? | Paris | 200"
        className="w-full rounded-xl border-2 border-edge bg-bg px-3 py-2 text-lg text-ink"
      />

      {questions.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">{plural(questions.length, 'question')} found</h3>
          <ol aria-label="Questions found" className="flex max-h-64 flex-col gap-1 overflow-y-auto">
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
          <ul aria-label="Lines skipped" className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {bad.map((line) => (
              <li key={line.line} className="rounded-lg bg-bg px-3 py-1">
                <span className="font-semibold">Line {line.line}:</span> {line.reasons.join(' ')}
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

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onAdd(adding)}
          disabled={adding.length === 0}
          className={`rounded-2xl bg-accent px-5 py-3 font-display text-xl text-accent-ink transition not-disabled:active:scale-95 disabled:opacity-40 ${HOVER}`}
        >
          Add {plural(adding.length, 'question')}
        </button>
        <button type="button" onClick={onCancel} className={button}>
          Cancel
        </button>
      </div>
    </section>
  );
}

// One multiple-choice question answered from the keyboard (§1 Check yourself, §1 `predict`
// exercises, §6: "`j`/`k` and `Enter` answer a Check yourself question when one has focus";
// "`predict` exercises replace the editor with the snippet, the options (`j`/`k`, `Enter`) and,
// after answering, the explanation"). The block itself takes focus; `j`/`k` (or the arrows) move
// the highlighted option and `Enter` answers it. After an answer it says whether it was right
// and shows the explanation; another answer is allowed (§1 "retries allowed").
import { useState, type Ref } from 'react';
import { cn } from 'cn';

const LETTERS = 'abcde';

export interface QuestionProps {
  ref?: Ref<HTMLElement>;
  /** Labels the block; also the element id of the question text. */
  id: string;
  question: string;
  options: readonly string[];
  /** The correct option. */
  answer: number;
  explanation: string;
  code?: string | undefined;
  /** The answer given before (stored), if any. */
  chosen: number | undefined;
  onAnswer: (index: number) => void;
  className?: string;
  /** Extra attributes for the block (`data-check-id`). */
  dataAttributes?: Record<`data-${string}`, string>;
}

export function Question({
  ref,
  id,
  question,
  options,
  answer,
  explanation,
  code,
  chosen,
  onAnswer,
  className,
  dataAttributes,
}: QuestionProps) {
  const [highlight, setHighlight] = useState(chosen ?? 0);
  const answered = chosen !== undefined;
  const correct = chosen === answer;

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.target !== event.currentTarget) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    switch (event.key) {
      case 'j':
      case 'ArrowDown':
        setHighlight((at) => Math.min(options.length - 1, at + 1));
        break;
      case 'k':
      case 'ArrowUp':
        setHighlight((at) => Math.max(0, at - 1));
        break;
      case 'Enter':
        onAnswer(highlight);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const questionId = `question-${id}`;
  return (
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- the question block takes focus and answers with j/k/Enter (§6) */
    <section
      ref={ref}
      tabIndex={0}
      data-question
      data-answered={answered ? 'true' : 'false'}
      data-correct={answered ? String(correct) : undefined}
      aria-labelledby={questionId}
      onKeyDown={onKeyDown}
      className={cn(
        'my-4 rounded-md border px-4 py-3 outline-none focus:ring-2 focus:ring-ring',
        className,
      )}
      {...dataAttributes}
    >
      <p id={questionId} className="m-0 font-medium">
        {question}
      </p>
      {code !== undefined ? (
        <pre className="my-2 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-sm">
          {code}
        </pre>
      ) : null}
      <ol className="m-0 mt-2 list-none p-0 text-sm" aria-label="Options">
        {options.map((option, index) => (
          <li
            key={index}
            data-option={index}
            data-highlighted={index === highlight ? 'true' : undefined}
            data-chosen={index === chosen ? 'true' : undefined}
            className={cn(
              'flex gap-2 rounded px-1 py-0.5',
              index === highlight && 'bg-accent',
            )}
          >
            <span className="w-4 shrink-0 text-muted-foreground">
              {LETTERS[index] ?? String(index + 1)}
            </span>
            <code className="font-mono">{option}</code>
            {index === chosen ? (
              <span className="ml-auto text-xs text-muted-foreground">
                your answer
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {answered ? (
        <div className="mt-2 text-sm" data-testid="explanation">
          <p
            className={cn(
              'm-0 font-medium',
              correct ? 'text-foreground' : 'text-destructive',
            )}
            data-result={correct ? 'correct' : 'incorrect'}
          >
            {correct ? 'Correct.' : 'Not quite. Try again: j, k and Enter.'}
          </p>
          <p className="m-0 mt-1 text-muted-foreground">{explanation}</p>
        </div>
      ) : (
        <p className="m-0 mt-2 text-xs text-muted-foreground">
          j and k choose, Enter answers.
        </p>
      )}
    </section>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  );
}

// `<Predict>` (spec §3 MDX components, §1 Check yourself): an inline question with 2–5 options
// and one correct answer. F6 renders it; answering with `j`/`k`/`Enter`, the explanation after
// an answer and the per-lesson storage are F8's (§6 Lesson page, §7).
import type { CodeBlockElementProps } from './code-block';

export interface PredictElementProps {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  code?: string;
}

const LETTERS = 'abcde';

export function Predict({ id, question, options, code }: PredictElementProps) {
  return (
    <section
      className="predict my-4 rounded-md border px-4 py-3"
      data-check-id={id}
      aria-labelledby={`predict-${id}`}
    >
      <p id={`predict-${id}`} className="m-0 font-medium">
        {question}
      </p>
      {code !== undefined ? (
        <pre className="my-2 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-sm">
          {code}
        </pre>
      ) : null}
      <ol className="m-0 mt-2 list-none p-0 text-sm">
        {options.map((option, index) => (
          <li key={index} className="flex gap-2 py-0.5" data-option={index}>
            <span className="w-4 shrink-0 text-muted-foreground">
              {LETTERS[index] ?? String(index + 1)}
            </span>
            <code className="font-mono">{option}</code>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The MDX props of a `<CodeBlock>`, re-exported so theory.tsx has one place to type the map. */
export type { CodeBlockElementProps };

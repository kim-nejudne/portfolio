// `<Predict>` (spec §3 MDX components, §1 Check yourself): an inline question with 2–5 options
// and one correct answer, answered in place with `j`/`k`/`Enter` (src/content/components/
// question.tsx); the explanation shows after each answer and retries are allowed. The lesson
// page stores the answers (§7 `lessons.questions`) through `LessonProgressContext`; `:done`
// finds the unanswered ones by `data-check-id`.
import { useState } from 'react';
import type { CodeBlockElementProps } from './code-block';
import { useLessonProgress } from './lesson-progress';
import { Question } from './question';

export interface PredictElementProps {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  code?: string;
}

export function Predict({
  id,
  question,
  options,
  answer,
  explanation,
  code,
}: PredictElementProps) {
  const progress = useLessonProgress();
  const [local, setLocal] = useState<number | undefined>(undefined);
  const chosen = local ?? progress?.answers[id];
  return (
    <Question
      id={`check-${id}`}
      question={question}
      options={options}
      answer={answer}
      explanation={explanation}
      code={code}
      chosen={chosen}
      onAnswer={(index) => {
        setLocal(index);
        progress?.answer(id, index, index === answer);
      }}
      className="predict"
      dataAttributes={{ 'data-check-id': id }}
    />
  );
}

/** The MDX props of a `<CodeBlock>`, re-exported so theory.tsx has one place to type the map. */
export type { CodeBlockElementProps };

// The lesson's Check yourself answers for the theory's `<Predict>` questions (§1 Completion,
// §7 `lessons.questions`): the lesson page provides the stored answers and the callback that
// records one; outside a lesson page (or before the store has answered) the questions still
// render and answers are kept for the page load only.
import { createContext, useContext } from 'react';

export interface LessonProgress {
  /** Question id → the index answered last. */
  answers: Readonly<Record<string, number>>;
  answer: (questionId: string, index: number, correct: boolean) => void;
}

export const LessonProgressContext = createContext<LessonProgress | null>(null);

export function useLessonProgress(): LessonProgress | null {
  return useContext(LessonProgressContext);
}

// The lesson a theory page is rendering, for the MDX components that need it: `<CodeBlock>`
// names its REPL buffer after the lesson folder, `<Predict>` stores answers per lesson (F8).
import { createContext, useContext } from 'react';
import type { Lesson } from '../build-registry';

export const LessonContext = createContext<Lesson | null>(null);

export function useLessonContext(): Lesson | null {
  return useContext(LessonContext);
}

// What the practice side asks of the lesson page (§4 Ex commands, §6 Lesson page): pane focus,
// moving between exercises and lessons, `:done`, `:layout`, a notice the page shows, and the
// §1 completion check after an exercise passes. The lesson page implements it
// (src/pages/lesson.tsx); the editor host and the `predict` panel call it.
import { createContext, useContext } from 'react';
import type { FocusDirection, LayoutMode, Pane } from '@/editor/host';
import type { LessonShape } from '@/store/completion';

export interface LessonController {
  lessonId: string;
  shape: LessonShape;
  /** Focuses a pane; one the layout hides is shown first. */
  focusPane(pane: Pane): void;
  /** `Ctrl-h/j/k/l` from `from`; nothing happens when no pane lies that way. */
  focusDirection(from: Pane, direction: FocusDirection): void;
  next(): void;
  prev(): void;
  lesson(direction: 'next' | 'prev'): void;
  done(): void;
  layout(mode: LayoutMode): void;
  notify(text: string): void;
  /** §1: re-checks whether the lesson is now complete (after a pass). */
  refreshCompletion(): void;
}

export const LessonControllerContext = createContext<LessonController | null>(
  null,
);

export function useLessonController(): LessonController {
  const controller = useContext(LessonControllerContext);
  if (controller === null) {
    throw new Error('useLessonController needs the lesson page');
  }
  return controller;
}

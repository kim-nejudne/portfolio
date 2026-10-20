// What a page answers for an ex command another page or a later feature owns (§4 Ex commands):
// the editor dispatches every host action to whichever page is mounted, and a page that cannot
// honour one says who does in a notification. Shared by /repl and the lesson page.
import type { HostAction } from '@/editor/host';

export const NOT_HERE: Partial<Record<HostAction['type'], string>> = {
  test: ':test runs the verification on a lesson page',
  hint: ':hint needs a lesson page',
  solution: ':sol needs a lesson page',
  reset: ':reset needs a lesson page',
  done: ':done needs a lesson page',
  next: ':next needs a lesson page',
  prev: ':prev needs a lesson page',
  lesson: ':lesson needs a lesson page',
  layout: ':layout needs a lesson page',
  prompt: ':prompt needs a lesson page',
  export: ':export needs the progress store (F9)',
};

/** The lesson page's own answers: the row F9 builds, and the /repl-only buffers. */
export const NOT_ON_LESSON_PAGE: Partial<Record<HostAction['type'], string>> = {
  export: ':export needs the progress store (F9)',
  edit: ':e is /repl only: an exercise has a fixed set of files',
  bdelete: ':bd is /repl only: an exercise has a fixed set of files',
};

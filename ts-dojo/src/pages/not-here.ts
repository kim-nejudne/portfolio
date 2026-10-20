// What a page answers for an ex command another page or a later feature owns (§4 Ex commands):
// the editor dispatches every host action to whichever page is mounted, and a page that cannot
// honour one says who does in a notification. Shared by /repl and the lesson page.
import type { HostAction } from '@/editor/host';

export const NOT_HERE: Partial<Record<HostAction['type'], string>> = {
  test: ':test runs the verification on a lesson page (F7)',
  hint: ':hint needs a lesson page (F8)',
  solution: ':sol needs a lesson page (F8)',
  reset: ':reset needs a lesson page (F8)',
  done: ':done needs a lesson page (F8)',
  next: ':next needs a lesson page (F8)',
  prev: ':prev needs a lesson page (F8)',
  lesson: ':lesson needs a lesson page (F8)',
  layout: ':layout needs a lesson page (F8)',
  prompt: ':prompt needs a lesson page (F8)',
  export: ':export needs the progress store (F9)',
};

/** The lesson page's own answers: the rows F8 and F9 build there, and the /repl-only buffers. */
export const NOT_ON_LESSON_PAGE: Partial<Record<HostAction['type'], string>> = {
  hint: ':hint is built with the lesson page (F8)',
  solution: ':sol is built with the lesson page (F8)',
  reset: ':reset is built with the lesson page (F8)',
  done: ':done is built with the lesson page (F8)',
  next: ':next is built with the lesson page (F8)',
  prev: ':prev is built with the lesson page (F8)',
  lesson: ':lesson is built with the lesson page (F8)',
  layout: ':layout is built with the lesson page (F8)',
  prompt: ':prompt is built with the lesson page (F8)',
  export: ':export needs the progress store (F9)',
  edit: ':e is /repl only: an exercise has a fixed set of files',
  bdelete: ':bd is /repl only: an exercise has a fixed set of files',
};

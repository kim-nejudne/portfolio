// The reading-pane keys (§6 Global keys: "`j k gg G Ctrl-d Ctrl-u` Scroll the focused reading
// pane"): the lesson's theory pane now, the module page and the roadmap at F9. Pure: which
// scroll a key asks for, and where it lands. `g` waits for a second `g` (`gg`); the window's
// global map also sees `g` as the start of `g r`/`g n`/`g p`, and a pane that handles the
// second `g` prevents the default so the global map stays out of it.
import type { KeyLike } from './keys';

export type ReadingScroll =
  'down' | 'up' | 'halfDown' | 'halfUp' | 'top' | 'bottom';

/** Pixels per `j`/`k`, about one line of prose. */
export const LINE_PX = 40;

/** A scroll, `pendingG` for a first `g`, or null for a key that is not a reading key. */
export function readingKey(
  event: KeyLike,
  afterG: boolean,
): ReadingScroll | 'pendingG' | null {
  if (event.altKey === true || event.metaKey === true) return null;
  if (event.ctrlKey === true) {
    if (event.key === 'd') return 'halfDown';
    if (event.key === 'u') return 'halfUp';
    return null;
  }
  switch (event.key) {
    case 'j':
      return 'down';
    case 'k':
      return 'up';
    case 'G':
      return 'bottom';
    case 'g':
      return afterG ? 'top' : 'pendingG';
    default:
      return null;
  }
}

export interface ScrollBox {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export function scrollTarget(scroll: ReadingScroll, box: ScrollBox): number {
  const max = Math.max(0, box.scrollHeight - box.clientHeight);
  const half = Math.round(box.clientHeight / 2);
  const next = {
    down: box.scrollTop + LINE_PX,
    up: box.scrollTop - LINE_PX,
    halfDown: box.scrollTop + half,
    halfUp: box.scrollTop - half,
    top: 0,
    bottom: max,
  }[scroll];
  return Math.max(0, Math.min(max, next));
}

// What the mounted page does with the page-level global keys (§6: `g n`, `g p`, `] e`, `[ e`,
// `Ctrl-h/j/k/l`, `1 2 3`, `Esc`) and with an ex command run from the palette: one about the
// page as a whole, from whichever pane had the focus, or any command when no editor is on the
// page (a `predict` exercise, F8). One page at a time registers; the layout's global
// key handlers and the palette ask it first and fall back when it does not handle the action.
import type { HostAction } from '@/editor/host';
import type { GlobalAction } from './keys';

export interface PageActions {
  /** A global key; true when the page handled it. */
  key?: (action: GlobalAction) => boolean;
  /**
   * An ex command from the palette; `origin` had the focus when the palette opened. True when
   * the page handled it (else the editor runs it).
   */
  ex?: (action: HostAction, origin: Element | null) => boolean;
}

let current: PageActions | null = null;

/** Registers the page's actions; the returned function unregisters them (only if still current). */
export function setPageActions(actions: PageActions): () => void {
  current = actions;
  return () => {
    if (current === actions) current = null;
  };
}

export function getPageActions(): PageActions | null {
  return current;
}

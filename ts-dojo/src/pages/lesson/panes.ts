// The lesson page's three focus targets (§4 Focus and panes): theory on the left, the editor
// (or a `predict` exercise's question) above the output pane on the right. `Ctrl-h/j/k/l`
// move by position, from the editor through the vimrc's `:focus` mappings and from the other
// panes through the global keys; `1`/`2`/`3` and `Esc` name a pane directly. A pane hidden by
// `:layout` is never a target. Pure; the lesson page owns the DOM.
import type { FocusDirection, LayoutMode, Pane } from '@/editor/host';

export function visiblePanes(layout: LayoutMode, hasOutput: boolean): Pane[] {
  const panes: Pane[] = [];
  if (layout !== 'practice') panes.push('theory');
  if (layout !== 'theory') {
    panes.push('editor');
    if (hasOutput) panes.push('output');
  }
  return panes;
}

const NEIGHBOURS: Record<Pane, Partial<Record<FocusDirection, Pane>>> = {
  theory: { right: 'editor' },
  editor: { left: 'theory', down: 'output' },
  output: { up: 'editor', left: 'theory' },
};

export function paneInDirection(
  from: Pane,
  direction: FocusDirection,
  layout: LayoutMode,
  hasOutput: boolean,
): Pane | null {
  const target = NEIGHBOURS[from][direction];
  if (target === undefined) return null;
  return visiblePanes(layout, hasOutput).includes(target) ? target : null;
}

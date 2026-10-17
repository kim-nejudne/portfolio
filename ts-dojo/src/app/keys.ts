// The global keyboard map (spec §6 Global keys). These fire only when the editor does not have
// focus: inside the editor every key is Vim's and the ex commands reach the app (the §6
// conflict rule), so the hook that applies this map skips editable targets and anything inside
// `.cm-editor`. F1 wires `?`; F3 and F8 add the rest, including the two-key sequences.
export interface GlobalKey {
  keys: string;
  action: string;
}

/** The §6 table, in its order; the help overlay renders it. */
export const GLOBAL_KEYS: readonly GlobalKey[] = [
  { keys: '?', action: 'Keyboard help overlay, with the Vim gaps list' },
  {
    keys: 'Ctrl-p',
    action:
      'Command palette: lessons, exercises and every ex command, fuzzy-matched',
  },
  { keys: 'g r', action: 'Roadmap' },
  { keys: 'g n / g p', action: 'Next / previous lesson' },
  { keys: '] e / [ e', action: 'Next / previous exercise' },
  { keys: 'Ctrl-h j k l', action: 'Pane focus' },
  { keys: '1 2 3', action: 'Focus theory / editor / output' },
  { keys: 'Esc', action: 'Focus the editor' },
  { keys: 'j k gg G Ctrl-d Ctrl-u', action: 'Scroll the focused reading pane' },
  { keys: 'Enter', action: 'Activate the focused item' },
];

export type GlobalAction = 'help';

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export function matchGlobalKey(event: KeyLike): GlobalAction | null {
  if (
    event.ctrlKey === true ||
    event.altKey === true ||
    event.metaKey === true
  ) {
    return null;
  }
  if (event.key === '?') return 'help';
  return null;
}

export interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** True when a key press here belongs to a text field or to the editor, never to the app. */
export function isEditableTarget(
  target: TargetLike | null | undefined,
): boolean {
  if (target === null || target === undefined) return false;
  if (
    target.tagName !== undefined &&
    EDITABLE_TAGS.has(target.tagName.toUpperCase())
  ) {
    return true;
  }
  if (target.isContentEditable === true) return true;
  const inEditor = target.closest?.('.cm-editor');
  return inEditor !== null && inEditor !== undefined;
}

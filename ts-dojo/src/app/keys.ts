// The global keyboard map (spec §6 Global keys). These fire only when the editor does not have
// focus: inside the editor every key is Vim's and the ex commands reach the app (the §6
// conflict rule), so the hook that applies this map skips editable targets and anything inside
// `.cm-editor`, and a key pressed inside a dialog stays with the dialog. F1 wired `?`; F3 adds
// `Ctrl-p` and the two-key sequences (`g r`, `g n`, `g p`, `] e`, `[ e`); F8 adds the pane keys
// (`Ctrl-h/j/k/l`, `1 2 3`, `Esc`). The scrolling keys belong to the focused reading pane
// (src/app/reading-keys.ts) and `Enter` to the focused element itself.
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

export type GlobalAction =
  | 'help'
  | 'palette'
  | 'roadmap'
  | 'lessonNext'
  | 'lessonPrev'
  | 'exerciseNext'
  | 'exercisePrev'
  | 'focusTheory'
  | 'focusEditor'
  | 'focusOutput'
  | 'focusLeft'
  | 'focusDown'
  | 'focusUp'
  | 'focusRight';

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

/** The first key of a two-key sequence, waiting for the second. */
export type KeyPrefix = 'g' | ']' | '[';

export type GlobalKeyMatch =
  | { kind: 'action'; action: GlobalAction }
  | { kind: 'prefix'; prefix: KeyPrefix }
  | { kind: 'none' };

const CTRL_KEYS: Record<string, GlobalAction> = {
  p: 'palette',
  h: 'focusLeft',
  j: 'focusDown',
  k: 'focusUp',
  l: 'focusRight',
};

const SINGLE_KEYS: Record<string, GlobalAction> = {
  '?': 'help',
  '1': 'focusTheory',
  '2': 'focusEditor',
  '3': 'focusOutput',
  Escape: 'focusEditor',
};

const SEQUENCES: Record<KeyPrefix, Record<string, GlobalAction>> = {
  g: { r: 'roadmap', n: 'lessonNext', p: 'lessonPrev' },
  ']': { e: 'exerciseNext' },
  '[': { e: 'exercisePrev' },
};

/**
 * Matches one key press against the §6 table. `prefix` is the first key of a sequence pressed
 * just before, if any; a second key that completes no sequence is dropped with the prefix.
 */
export function matchGlobalKey(
  event: KeyLike,
  prefix: KeyPrefix | null = null,
): GlobalKeyMatch {
  if (event.altKey === true || event.metaKey === true) return { kind: 'none' };
  if (event.ctrlKey === true) {
    const action = event.shiftKey === true ? undefined : CTRL_KEYS[event.key];
    return action === undefined ? { kind: 'none' } : { kind: 'action', action };
  }
  if (prefix !== null) {
    const action = SEQUENCES[prefix][event.key];
    return action === undefined ? { kind: 'none' } : { kind: 'action', action };
  }
  const single = SINGLE_KEYS[event.key];
  if (single !== undefined) return { kind: 'action', action: single };
  if (event.key === 'g' || event.key === ']' || event.key === '[') {
    return { kind: 'prefix', prefix: event.key };
  }
  return { kind: 'none' };
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

/** True inside a dialog (the help overlay, the palette): its own keys, `Esc` included, win. */
export function isInDialog(target: TargetLike | null | undefined): boolean {
  const dialog = target?.closest?.('[role="dialog"], [role="alertdialog"]');
  return dialog !== null && dialog !== undefined;
}

/**
 * The level review's keyboard shortcuts (F125): one map that the page's key handler and the
 * buttons' `<kbd>` hints both read, so a key and its hint cannot drift apart. The keys are on only
 * on a laptop (`useDesktopLayout()` and `usePointerFine()`), and never while the admin is typing.
 */

/** A shortcut on the review page itself, acting on the focused card (or the level). */
export type ReviewAction = 'next' | 'prev' | 'edit' | 'replace' | 'preview' | 'mark';

/** A shortcut inside an open edit (or Replace/Add note) form. */
export type FormAction = 'save' | 'cancel';

/** The parts of a `KeyboardEvent` the map reads. */
export interface KeyLike {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat?: boolean;
}

interface ReviewKey {
  /** `KeyboardEvent.key` values, letters in lower case. */
  keys: readonly string[];
  /** Shift must be held (Shift+M), or must not be. */
  shift: boolean;
  /** Held down, the key acts again on each repeat. */
  repeats: boolean;
  /** What the button shows in its `<kbd>`. */
  hint: string;
  /** `aria-keyshortcuts`, in key names. */
  aria: string;
}

export const REVIEW_KEYS: Readonly<Record<ReviewAction, ReviewKey>> = {
  next: { keys: ['j', 'ArrowDown'], shift: false, repeats: true, hint: 'J', aria: 'J ArrowDown' },
  prev: { keys: ['k', 'ArrowUp'], shift: false, repeats: true, hint: 'K', aria: 'K ArrowUp' },
  edit: { keys: ['e'], shift: false, repeats: false, hint: 'E', aria: 'E' },
  replace: { keys: ['r'], shift: false, repeats: false, hint: 'R', aria: 'R' },
  preview: { keys: ['p'], shift: false, repeats: false, hint: 'P', aria: 'P' },
  mark: { keys: ['m'], shift: true, repeats: false, hint: 'Shift+M', aria: 'Shift+M' },
};

export const FORM_KEYS: Readonly<Record<FormAction, { aria: string }>> = {
  save: { aria: 'Control+Enter Meta+Enter' },
  cancel: { aria: 'Escape' },
};

/** The Save hint: ⌘+Enter on a Mac, iPad or iPhone, else Ctrl+Enter. Both keys work everywhere. */
export function saveHint(platform: string): string {
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘+Enter' : 'Ctrl+Enter';
}

export const CANCEL_HINT = 'Esc';

const ORDER = Object.keys(REVIEW_KEYS) as ReviewAction[];

/**
 * The page shortcut a key press means, or null. Ctrl, ⌘ and Alt leave the browser's own keys
 * alone, and only moving between cards acts again while a key is held.
 */
export function reviewAction(event: KeyLike): ReviewAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const action = ORDER.find((name) => {
    const def = REVIEW_KEYS[name];
    return def.keys.includes(key) && def.shift === event.shiftKey;
  });
  if (!action) return null;
  if (event.repeat && !REVIEW_KEYS[action].repeats) return null;
  return action;
}

/** Ctrl+Enter or ⌘+Enter saves, a bare Esc cancels. */
export function formAction(event: KeyLike): FormAction | null {
  if (event.altKey || event.repeat) return null;
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.shiftKey) return 'save';
  if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    return 'cancel';
  }
  return null;
}

/** Focus is in a text box, a select or editable text: letters there are typing, not shortcuts. */
export function isTyping(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * The card to focus after next (+1) or previous (-1), from `current` (-1 when no card has focus):
 * with none, next goes to the first and previous to the last. It stops at either end.
 */
export function stepCard(current: number, count: number, direction: 1 | -1): number | null {
  if (count <= 0) return null;
  if (current < 0 || current >= count) return direction === 1 ? 0 : count - 1;
  return Math.min(count - 1, Math.max(0, current + direction));
}

// A page's own single keys, next to the §6 global ones: the roadmap's `j k h l c` (§6 Roadmap)
// and the module page's `j k` (§6 Module page). One window keydown listener while the page is
// mounted, with the guards of the global map (use-global-keys.ts): never in a text field or the
// editor, never inside a dialog, never with Ctrl, Alt or Meta, never for a key something else
// already handled. None of these keys is a global single key, so neither map shadows the other;
// `Enter` stays with the focused link (§6 "Activate the focused item"). Auto-repeat is allowed,
// so holding `j` walks the cards.
import { useEffect, useRef } from 'react';
import {
  isEditableTarget,
  isInDialog,
  type KeyLike,
  type TargetLike,
} from './keys';

/** The key a page may act on, or null when the press belongs to something else. */
export function pageKeyOf(
  event: KeyLike & { defaultPrevented?: boolean },
  target: TargetLike | null,
): string | null {
  if (event.defaultPrevented === true) return null;
  if (
    event.ctrlKey === true ||
    event.altKey === true ||
    event.metaKey === true
  ) {
    return null;
  }
  if (isEditableTarget(target) || isInDialog(target)) return null;
  return event.key;
}

/** `handle` returns true for a key it used; that key's default is then prevented. */
export function usePageKeys(handle: (key: string) => boolean): void {
  const latest = useRef(handle);
  useEffect(() => {
    latest.current = handle;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      const key = pageKeyOf(event, target);
      if (key !== null && latest.current(key)) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

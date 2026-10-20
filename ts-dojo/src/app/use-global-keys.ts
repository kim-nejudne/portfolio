// Applies the §6 global keys from one window keydown listener. Skips auto-repeat, events
// something else already handled, editable targets and the editor (the §6 conflict rule), and
// keys pressed inside a dialog. A
// two-key sequence (`g r`, `] e`) waits up to SEQUENCE_TIMEOUT_MS for its second key, like
// Vim's timeoutlen. Pass a memoised handlers object; the listener is replaced when it changes.
import { useEffect } from 'react';
import {
  isEditableTarget,
  isInDialog,
  matchGlobalKey,
  type GlobalAction,
  type KeyPrefix,
} from './keys';

export type GlobalKeyHandlers = Partial<Record<GlobalAction, () => void>>;

export const SEQUENCE_TIMEOUT_MS = 1000;

export function useGlobalKeys(handlers: GlobalKeyHandlers): void {
  useEffect(() => {
    let prefix: KeyPrefix | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const clearPrefix = (): void => {
      prefix = null;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      // A key the focused element handled (the theory pane's `gg`) also ends a pending
      // sequence: `g g n` is top-of-pane then `n`, never `g n`.
      if (event.defaultPrevented) {
        clearPrefix();
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (isEditableTarget(target) || isInDialog(target)) {
        clearPrefix();
        return;
      }
      const match = matchGlobalKey(event, prefix);
      clearPrefix();
      if (match.kind === 'prefix') {
        prefix = match.prefix;
        timer = setTimeout(clearPrefix, SEQUENCE_TIMEOUT_MS);
        return;
      }
      if (match.kind === 'none') return;
      const handler = handlers[match.action];
      if (handler === undefined) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearPrefix();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handlers]);
}

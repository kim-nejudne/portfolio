// Applies the §6 global keys from one window keydown listener. Skips auto-repeat, events
// something else already handled, editable targets and the editor (the §6 conflict rule). A
// two-key sequence (`g r`, `] e`) waits up to SEQUENCE_TIMEOUT_MS for its second key, like
// Vim's timeoutlen. Pass a memoised handlers object; the listener is replaced when it changes.
import { useEffect } from 'react';
import {
  isEditableTarget,
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
      if (event.defaultPrevented || event.repeat) return;
      const target = event.target instanceof Element ? event.target : null;
      if (isEditableTarget(target)) {
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

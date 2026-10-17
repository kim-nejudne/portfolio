// Applies the §6 global keys from one window keydown listener. Skips auto-repeat, events
// something else already handled, editable targets and the editor (the §6 conflict rule).
// Pass a memoised handlers object; the listener is replaced when it changes.
import { useEffect } from 'react';
import { isEditableTarget, matchGlobalKey, type GlobalAction } from './keys';

export type GlobalKeyHandlers = Partial<Record<GlobalAction, () => void>>;

export function useGlobalKeys(handlers: GlobalKeyHandlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat) return;
      const target = event.target instanceof Element ? event.target : null;
      if (isEditableTarget(target)) return;
      const action = matchGlobalKey(event);
      if (action === null) return;
      const handler = handlers[action];
      if (handler === undefined) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}

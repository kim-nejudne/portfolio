import { useEffect, useState } from 'react';
import { useRoomStore, type FxEvent } from './roomStore.js';

/** How long a judgement's flash and "+100" stay on the Screen. */
export const FX_MS = 1500;

/**
 * The latest `fx` event for `FX_MS` after it arrives, then null. An event already in the store
 * when the component mounts counts as old, so a remount never replays it.
 */
export function useRecentFx(): FxEvent | null {
  const event = useRoomStore((state) => state.fx);
  const [doneSeq, setDoneSeq] = useState(() => event?.seq ?? 0);
  const fresh = event !== null && event.seq > doneSeq;

  useEffect(() => {
    if (!fresh) return;
    const timer = setTimeout(() => setDoneSeq(event.seq), FX_MS);
    return () => clearTimeout(timer);
  }, [fresh, event]);

  return fresh ? event : null;
}

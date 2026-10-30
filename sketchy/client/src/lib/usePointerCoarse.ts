import { useSyncExternalStore } from 'react';

/**
 * A touch-first device (`pointer: coarse`): a tablet or phone used as the Screen, as opposed to a
 * laptop on a TV. It picks "Tap to start" over "Click to start" and shows "Keep this device
 * plugged in" in the lobby (UI by role and phase, Screen). Ported from Buzzr
 * (buzzer/client/src/lib/usePointerFine.ts). A touch laptop's primary pointer is still fine.
 */
const QUERY = '(pointer: coarse)';

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

const current = () => window.matchMedia(QUERY).matches;

export function usePointerCoarse(): boolean {
  return useSyncExternalStore(subscribe, current, () => false);
}

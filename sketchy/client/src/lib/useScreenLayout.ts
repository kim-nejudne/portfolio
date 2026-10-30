import { useSyncExternalStore } from 'react';
import { screenLayout, type ScreenLayout } from './screen.js';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

const current = (): ScreenLayout => screenLayout(window.innerWidth, window.innerHeight);

/** The Screen's layout for the window's current size; a resize or a turned tablet switches it. */
export function useScreenLayout(): ScreenLayout {
  return useSyncExternalStore(subscribe, current, current);
}

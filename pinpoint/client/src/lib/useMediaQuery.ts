import { useSyncExternalStore } from 'react';

/** 1024 px, Tailwind's `lg`: from here the admin shows the list pane beside the open page. */
export const DESKTOP_QUERY = '(min-width: 64rem)';

function subscribeTo(query: string) {
  return (onChange: () => void) => {
    const list = typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
    list?.addEventListener('change', onChange);
    return () => list?.removeEventListener('change', onChange);
  };
}

const subscribers = new Map<string, (onChange: () => void) => () => void>();

/** Whether a media query matches now, re-rendering when it changes. False without matchMedia. */
export function useMediaQuery(query: string): boolean {
  let subscribe = subscribers.get(query);
  if (!subscribe) subscribers.set(query, (subscribe = subscribeTo(query)));
  return useSyncExternalStore(
    subscribe,
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** True from 1024 px. False without matchMedia, so test DOMs get the one-pane layout. */
export function useDesktopLayout(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}

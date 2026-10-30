import { useSyncExternalStore } from 'react';

/**
 * Tailwind's `lg` breakpoint (1024px): the remote's two-column dashboard (F99). For a layout that
 * changes what is rendered, not just how it looks, so tabs and panels can come and go.
 */
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

/**
 * True from Tailwind's `lg` up. False without matchMedia, so phones and test DOMs get the
 * phone layout, the baseline.
 */
export function useDesktopLayout(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}

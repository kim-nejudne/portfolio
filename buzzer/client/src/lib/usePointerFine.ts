import { useSyncExternalStore } from 'react';

/** A mouse or trackpad that can hover: the device for "Click" copy and key hints (FND-08). */
export const POINTER_FINE_QUERY = '(hover: hover) and (pointer: fine)';

/** A finger is the main pointer: a phone or tablet. */
export const POINTER_COARSE_QUERY = '(pointer: coarse)';

function subscribeTo(query: string) {
  return (onChange: () => void) => {
    const list = typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
    list?.addEventListener('change', onChange);
    return () => list?.removeEventListener('change', onChange);
  };
}

const subscribers = new Map<string, (onChange: () => void) => () => void>();

/** Whether a media query matches now, re-rendering when it changes. False without matchMedia. */
function useMediaQuery(query: string): boolean {
  let subscribe = subscribers.get(query);
  if (!subscribe) subscribers.set(query, (subscribe = subscribeTo(query)));
  return useSyncExternalStore(
    subscribe,
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/**
 * True on a fine pointer that hovers (a laptop), false on touch, which is the default: phones are
 * most of Buzzr's devices. It updates when the input changes, such as a tablet gaining a mouse.
 * For copy and hints only, never for layout.
 */
export function usePointerFine(): boolean {
  return useMediaQuery(POINTER_FINE_QUERY);
}

/**
 * True when a finger is the main pointer. For the surfaces whose default is the mouse, such as
 * the Screen's Click to start on a laptop; a TV with no pointer at all stays on the mouse copy.
 */
export function usePointerCoarse(): boolean {
  return useMediaQuery(POINTER_COARSE_QUERY);
}

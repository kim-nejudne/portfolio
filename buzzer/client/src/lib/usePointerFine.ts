import { useMediaQuery } from './useMediaQuery.js';

/** A mouse or trackpad that can hover: the device for "Click" copy and key hints (FND-08). */
export const POINTER_FINE_QUERY = '(hover: hover) and (pointer: fine)';

/** A finger is the main pointer: a phone or tablet. */
export const POINTER_COARSE_QUERY = '(pointer: coarse)';

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

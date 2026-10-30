// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  POINTER_COARSE_QUERY,
  POINTER_FINE_QUERY,
  usePointerCoarse,
  usePointerFine,
} from './usePointerFine.js';

/** A stand-in `matchMedia` whose answer to the pointer query can change, as a real one does. */
function stubPointer(fine: boolean) {
  const listeners = new Set<() => void>();
  const state = { fine };
  const answers: Record<string, () => boolean> = {
    [POINTER_FINE_QUERY]: () => state.fine,
    [POINTER_COARSE_QUERY]: () => !state.fine,
  };
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (media: string) => ({
      get matches() {
        return answers[media]?.() ?? false;
      },
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }),
  });
  return {
    listeners,
    set(next: boolean) {
      state.fine = next;
      listeners.forEach((listener) => listener());
    },
  };
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('usePointerFine', () => {
  it('is true with a mouse or trackpad', () => {
    stubPointer(true);
    expect(renderHook(() => usePointerFine()).result.current).toBe(true);
  });

  it('is false on a touch screen', () => {
    stubPointer(false);
    expect(renderHook(() => usePointerFine()).result.current).toBe(false);
  });

  it('is false where the browser has no matchMedia', () => {
    expect(renderHook(() => usePointerFine()).result.current).toBe(false);
  });

  it('follows a change of pointer, and stops listening on unmount', () => {
    const pointer = stubPointer(false);
    const { result, unmount } = renderHook(() => usePointerFine());
    act(() => pointer.set(true));
    expect(result.current).toBe(true);
    act(() => pointer.set(false));
    expect(result.current).toBe(false);
    unmount();
    expect(pointer.listeners.size).toBe(0);
  });
});

describe('usePointerCoarse', () => {
  it('is true on a touch screen and false with a mouse', () => {
    stubPointer(false);
    expect(renderHook(() => usePointerCoarse()).result.current).toBe(true);
    cleanup();
    stubPointer(true);
    expect(renderHook(() => usePointerCoarse()).result.current).toBe(false);
  });

  it('is false where the browser has no matchMedia, so mouse copy is the default', () => {
    expect(renderHook(() => usePointerCoarse()).result.current).toBe(false);
  });
});

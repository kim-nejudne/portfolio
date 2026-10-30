// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DESKTOP_QUERY, useDesktopLayout } from './useMediaQuery.js';

function stubWidth(desktop: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (media: string) => ({
      matches: media === DESKTOP_QUERY && desktop,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('useDesktopLayout', () => {
  it("is Tailwind's lg breakpoint, 1024px", () => {
    expect(DESKTOP_QUERY).toBe('(min-width: 64rem)');
  });

  it('is true from lg up and false below it', () => {
    stubWidth(true);
    expect(renderHook(() => useDesktopLayout()).result.current).toBe(true);
    cleanup();
    stubWidth(false);
    expect(renderHook(() => useDesktopLayout()).result.current).toBe(false);
  });

  it('is false where the browser has no matchMedia, so the phone layout is the default', () => {
    expect(renderHook(() => useDesktopLayout()).result.current).toBe(false);
  });
});

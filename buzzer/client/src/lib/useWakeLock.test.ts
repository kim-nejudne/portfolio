// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from './useWakeLock.js';

/** A fake Wake Lock API. `held` lists the locks granted and not yet released. */
function stubWakeLock({ refuse = false } = {}) {
  const held = new Set<{ released: boolean; release: () => Promise<void> }>();
  const request = vi.fn(() => {
    if (refuse) return Promise.reject(new DOMException('Low battery', 'NotAllowedError'));
    const lock = {
      released: false,
      release: vi.fn(() => {
        lock.released = true;
        held.delete(lock);
        return Promise.resolve();
      }),
    };
    held.add(lock);
    return Promise.resolve(lock);
  });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return { held, request };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Lets the pending request promises settle. */
const settle = () => act(() => Promise.resolve());

afterEach(() => {
  Reflect.deleteProperty(navigator, 'wakeLock');
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('useWakeLock', () => {
  it('holds a screen wake lock while mounted and releases it on unmount', async () => {
    const { held, request } = stubWakeLock();
    const { unmount } = renderHook(() => useWakeLock());
    await settle();
    expect(request).toHaveBeenCalledWith('screen');
    expect(held.size).toBe(1);

    unmount();
    expect(held.size).toBe(0);
  });

  it('takes the lock again when the page comes back into view', async () => {
    const { held } = stubWakeLock();
    renderHook(() => useWakeLock());
    await settle();

    // The browser drops the lock when the page is hidden.
    const [lock] = [...held];
    await act(() => lock!.release());
    setVisibility('hidden');
    await settle();
    expect(held.size).toBe(0);

    setVisibility('visible');
    await settle();
    expect(held.size).toBe(1);
  });

  it('does not stack a second lock when the page turns visible while it holds one', async () => {
    const { held, request } = stubWakeLock();
    renderHook(() => useWakeLock());
    await settle();
    setVisibility('visible');
    await settle();
    expect(request).toHaveBeenCalledTimes(1);
    expect(held.size).toBe(1);
  });

  it('a visibility change while the request is pending does not take a second lock', async () => {
    const { held, request } = stubWakeLock();
    const { unmount } = renderHook(() => useWakeLock());
    setVisibility('visible');
    setVisibility('visible');
    await settle();
    expect(request).toHaveBeenCalledTimes(1);

    unmount();
    expect(held.size).toBe(0);
  });

  it('asks again after a refusal, on the next return to the page', async () => {
    const { request } = stubWakeLock({ refuse: true });
    renderHook(() => useWakeLock());
    await settle();
    setVisibility('visible');
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('releases a lock granted after unmount', async () => {
    const { held } = stubWakeLock();
    const { unmount } = renderHook(() => useWakeLock());
    unmount();
    await settle();
    expect(held.size).toBe(0);
  });

  it('does nothing where the browser has no Wake Lock API', () => {
    expect('wakeLock' in navigator).toBe(false);
    expect(() => renderHook(() => useWakeLock()).unmount()).not.toThrow();
  });
});

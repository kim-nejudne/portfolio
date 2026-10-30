import { describe, expect, it, vi } from 'vitest';
import { holdWakeLock, type WakeLockDocument, type WakeLockNavigator } from './wakeLock.js';

/** A fake `navigator.wakeLock` whose requests resolve or reject when the test says. */
function fakeApi() {
  type FakeSentinel = { released: boolean; release: ReturnType<typeof vi.fn<() => Promise<void>>> };
  const requests: { resolve: () => void; reject: () => void }[] = [];
  const sentinels: FakeSentinel[] = [];
  const nav: WakeLockNavigator = {
    wakeLock: {
      request: vi.fn(
        () =>
          new Promise<FakeSentinel>((resolve, reject) => {
            const sentinel: FakeSentinel = {
              released: false,
              release: vi.fn(async () => {
                sentinel.released = true;
              }),
            };
            requests.push({
              resolve: () => {
                sentinels.push(sentinel);
                resolve(sentinel);
              },
              reject: () => reject(new DOMException('no', 'NotAllowedError')),
            });
          }),
      ),
    },
  };
  return { nav, requests, sentinels };
}

/** A fake document: visibility and the listeners `holdWakeLock` adds. */
function fakeDoc(visible = true) {
  const listeners = new Map<string, Set<() => void>>();
  const doc: WakeLockDocument & {
    visibilityState: DocumentVisibilityState;
    set(visible: boolean): void;
    fire(type: string): void;
  } = {
    visibilityState: visible ? 'visible' : 'hidden',
    addEventListener: (type: string, cb: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener: (type: string, cb: () => void) => listeners.get(type)?.delete(cb),
    set(v) {
      doc.visibilityState = v ? 'visible' : 'hidden';
      doc.fire('visibilitychange');
    },
    fire(type) {
      for (const cb of listeners.get(type) ?? []) cb();
    },
  };
  return { doc, listeners };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('holdWakeLock', () => {
  it('asks for a screen lock at once on a visible page, and releases it on stop', async () => {
    const { nav, requests, sentinels } = fakeApi();
    const { doc, listeners } = fakeDoc();
    const stop = holdWakeLock(nav, doc);
    expect(nav.wakeLock!.request).toHaveBeenCalledWith('screen');
    requests[0]!.resolve();
    await settle();
    stop();
    expect(sentinels[0]!.release).toHaveBeenCalledOnce();
    expect([...listeners.values()].every((set) => set.size === 0)).toBe(true);
  });

  it('asks again when the page comes back (the browser drops the lock on hide)', async () => {
    const { nav, requests, sentinels } = fakeApi();
    const { doc } = fakeDoc();
    const stop = holdWakeLock(nav, doc);
    requests[0]!.resolve();
    await settle();
    // The browser releases it when the phone locks or the tab hides.
    sentinels[0]!.released = true;
    doc.set(false);
    expect(nav.wakeLock!.request).toHaveBeenCalledTimes(1);
    doc.set(true);
    expect(nav.wakeLock!.request).toHaveBeenCalledTimes(2);
    requests[1]!.resolve();
    await settle();
    stop();
    expect(sentinels[1]!.release).toHaveBeenCalledOnce();
  });

  it('waits for the page to show before asking, and never asks twice at once', async () => {
    const { nav, requests } = fakeApi();
    const { doc } = fakeDoc(false);
    const stop = holdWakeLock(nav, doc);
    expect(nav.wakeLock!.request).not.toHaveBeenCalled();
    doc.set(true);
    doc.fire('visibilitychange');
    doc.fire('pointerdown');
    expect(nav.wakeLock!.request).toHaveBeenCalledTimes(1);
    requests[0]!.resolve();
    await settle();
    // Held: a tap or another visibility event doesn't ask again.
    doc.fire('pointerdown');
    doc.fire('visibilitychange');
    expect(nav.wakeLock!.request).toHaveBeenCalledTimes(1);
    stop();
  });

  it('a refused request is retried on the next tap (browsers that want a user gesture)', async () => {
    const { nav, requests, sentinels } = fakeApi();
    const { doc } = fakeDoc();
    const stop = holdWakeLock(nav, doc);
    requests[0]!.reject();
    await settle();
    doc.fire('pointerdown');
    expect(nav.wakeLock!.request).toHaveBeenCalledTimes(2);
    requests[1]!.resolve();
    await settle();
    stop();
    expect(sentinels[0]!.release).toHaveBeenCalledOnce();
  });

  it('a lock that arrives after stop is released straight away', async () => {
    const { nav, requests, sentinels } = fakeApi();
    const { doc } = fakeDoc();
    const stop = holdWakeLock(nav, doc);
    stop();
    requests[0]!.resolve();
    await settle();
    expect(sentinels[0]!.release).toHaveBeenCalledOnce();
    doc.set(true);
    doc.fire('pointerdown');
    expect(nav.wakeLock!.request).toHaveBeenCalledTimes(1);
  });

  it('does nothing without the API, or when the request throws', () => {
    const { doc, listeners } = fakeDoc();
    expect(() => holdWakeLock({}, doc)()).not.toThrow();
    const throwing: WakeLockNavigator = {
      wakeLock: {
        request: () => {
          throw new TypeError('not allowed here');
        },
      },
    };
    const stop = holdWakeLock(throwing, doc);
    expect(() => doc.fire('pointerdown')).not.toThrow();
    stop();
    expect([...listeners.values()].every((set) => set.size === 0)).toBe(true);
  });
});

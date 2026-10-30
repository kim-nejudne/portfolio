// Screen Wake Lock (Canvas and drawing tools, Stopping scroll and zoom: "Request a Screen Wake Lock
// while drawing (re-request on `visibilitychange`)"). The browser drops the lock whenever the page
// hides, so it is asked for again when the page shows. A request the browser refuses (some want a
// user gesture) is retried on the next tap. Missing API or errors: the phone may just sleep.

import { useEffect } from 'react';

interface Sentinel {
  readonly released: boolean;
  release(): Promise<void>;
}

/** The part of `navigator` this needs (a fake in tests). */
export interface WakeLockNavigator {
  wakeLock?: { request(type: 'screen'): Promise<Sentinel> };
}

/** The part of `document` this needs (a fake in tests). */
export interface WakeLockDocument {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange' | 'pointerdown', cb: () => void): void;
  removeEventListener(type: 'visibilitychange' | 'pointerdown', cb: () => void): void;
}

const releaseQuietly = (sentinel: Sentinel) => {
  if (!sentinel.released) sentinel.release().catch(() => {});
};

/** Holds a screen wake lock until the returned stop is called. */
export function holdWakeLock(
  nav: WakeLockNavigator = navigator,
  doc: WakeLockDocument = document,
): () => void {
  const api = nav.wakeLock;
  if (!api) return () => {};
  let sentinel: Sentinel | null = null;
  let pending = false;
  let stopped = false;

  const request = () => {
    if (stopped || pending || doc.visibilityState !== 'visible') return;
    if (sentinel && !sentinel.released) return;
    pending = true;
    try {
      api.request('screen').then(
        (next) => {
          pending = false;
          if (stopped) releaseQuietly(next);
          else sentinel = next;
        },
        () => {
          pending = false;
        },
      );
    } catch {
      pending = false;
    }
  };

  doc.addEventListener('visibilitychange', request);
  doc.addEventListener('pointerdown', request);
  request();
  return () => {
    stopped = true;
    doc.removeEventListener('visibilitychange', request);
    doc.removeEventListener('pointerdown', request);
    if (sentinel) releaseQuietly(sentinel);
    sentinel = null;
  };
}

/** Keeps the screen on while `active`: a phone during a game, a started Screen. */
export function useWakeLock(active: boolean): void {
  useEffect(() => (active ? holdWakeLock() : undefined), [active]);
}

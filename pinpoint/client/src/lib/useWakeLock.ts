import { useEffect } from 'react';

/**
 * Keeps the screen awake while `enabled` (adapted from Buzzr). The browser drops the lock whenever
 * the page is hidden, so it is requested again each time the page becomes visible. Where the API is
 * missing (not a secure context, an older browser) or the request is refused, it does nothing.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    const wakeLock = 'wakeLock' in navigator ? navigator.wakeLock : undefined;
    if (!enabled || !wakeLock) return;
    let sentinel: WakeLockSentinel | null = null;
    let requesting = false;
    let active = true;

    const acquire = () => {
      if (document.visibilityState !== 'visible' || requesting) return;
      if (sentinel && !sentinel.released) return;
      requesting = true;
      wakeLock.request('screen').then(
        (lock) => {
          requesting = false;
          if (!active) return void lock.release().catch(() => {});
          sentinel = lock;
        },
        () => {
          requesting = false;
        },
      );
    };

    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}

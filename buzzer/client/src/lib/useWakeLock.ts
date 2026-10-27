import { useEffect } from 'react';

/**
 * Keeps the screen awake while the calling component is mounted (UI spec, Player view: Screen
 * Wake Lock). The browser drops the lock whenever the page is hidden, so it is requested again each
 * time the page becomes visible. Where the API is missing (an older browser, or plain HTTP on the
 * LAN, which is not a secure context) or the request is refused (low battery), it does nothing:
 * the phone may sleep, but the game still works.
 */
export function useWakeLock(): void {
  useEffect(() => {
    const wakeLock = 'wakeLock' in navigator ? navigator.wakeLock : undefined;
    if (!wakeLock) return;
    let sentinel: WakeLockSentinel | null = null;
    // A request still pending; a second visibility change meanwhile must not start another.
    let requesting = false;
    let active = true;

    const acquire = () => {
      if (document.visibilityState !== 'visible' || requesting) return;
      if (sentinel && !sentinel.released) return;
      requesting = true;
      wakeLock.request('screen').then(
        (lock) => {
          requesting = false;
          // Unmounted while the request was pending: let it go at once.
          if (!active) return void lock.release().catch(() => {});
          sentinel = lock;
        },
        (error: unknown) => {
          requesting = false;
          if (import.meta.env.DEV) console.debug('[wake lock] refused', error);
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
  }, []);
}

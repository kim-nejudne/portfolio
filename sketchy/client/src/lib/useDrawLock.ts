import { useEffect } from 'react';

const LOCKED_VIEWPORT =
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

const preventDefault = (e: Event) => e.preventDefault();
/** A second finger anywhere on the page is a pinch: stop it before the browser zooms. */
const preventMultiTouch = (e: TouchEvent) => {
  if (e.touches.length > 1) e.preventDefault();
};

/**
 * While the draw pad shows: no scroll, zoom, pull-to-refresh or rubber-banding (Canvas and drawing
 * tools, Stopping scroll and zoom). Pins the body (`position: fixed; inset: 0; overflow: hidden`),
 * locks the viewport scale, and cancels iOS Safari's gesture events and multi-touch moves, which
 * Safari honours where it ignores `user-scalable=no`. Everything is restored on unmount.
 */
export function useDrawLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    const before = {
      position: body.style.position,
      inset: body.style.inset,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.inset = '0';
    body.style.overflow = 'hidden';

    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const viewport = meta?.content ?? null;
    if (meta) meta.content = LOCKED_VIEWPORT;

    const options = { passive: false } as const;
    document.addEventListener('gesturestart', preventDefault, options);
    document.addEventListener('gesturechange', preventDefault, options);
    document.addEventListener('touchmove', preventMultiTouch, options);

    return () => {
      Object.assign(body.style, before);
      if (meta && viewport !== null) meta.content = viewport;
      document.removeEventListener('gesturestart', preventDefault);
      document.removeEventListener('gesturechange', preventDefault);
      document.removeEventListener('touchmove', preventMultiTouch);
    };
  }, [active]);
}

import { useLayoutEffect, type RefObject } from 'react';

/**
 * Sets the element's font size to the largest value, at most `maxOfWidth` × its own width and at
 * least `minPx`, at which its content fits its height. Sizes inside it written in `em` scale along.
 * It refits when the element is resized, when web fonts finish loading, and when `content` changes.
 * The Screen lobby uses it so every player chip stays above the bottom strip (F38).
 */
export function useShrinkToFit(
  ref: RefObject<HTMLElement | null>,
  maxOfWidth: number,
  minPx: number,
  content: string,
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fitsAt = (px: number) => {
      el.style.fontSize = `${px}px`;
      return el.scrollHeight <= el.clientHeight;
    };
    const fit = () => {
      let hi = Math.max(minPx, el.clientWidth * maxOfWidth);
      if (fitsAt(hi)) return;
      // Binary search to half a pixel: a handful of layouts, even for 50 chips.
      let lo = minPx;
      while (hi - lo > 0.5) {
        const mid = (lo + hi) / 2;
        if (fitsAt(mid)) lo = mid;
        else hi = mid;
      }
      fitsAt(lo);
    };
    fit();
    let live = true;
    void document.fonts?.ready.then(() => live && fit());
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        live = false;
      };
    }
    // Only the element's own box is watched; the font size changes its content, never its box.
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [ref, maxOfWidth, minPx, content]);
}

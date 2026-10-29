import { useLayoutEffect, type RefObject } from 'react';

/**
 * Sets the element's font size to the largest value, at most `max` and at least `minPx`, at which
 * its content fits its height. `max` is a share of its own width, or `'css'` for the size its
 * classes give it, so it only ever shrinks. Sizes inside it written in `em` scale along.
 * It refits when the element is resized, when web fonts finish loading, and when `content` changes.
 * The Screen lobby uses it so every player chip stays above the bottom strip (F38), and the Screen's
 * question so its text stays above the answer (F52).
 */
export function useShrinkToFit(
  ref: RefObject<HTMLElement | null>,
  max: number | 'css',
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
      let cap: number;
      if (max === 'css') {
        el.style.fontSize = '';
        cap = parseFloat(getComputedStyle(el).fontSize);
      } else {
        cap = el.clientWidth * max;
      }
      let hi = Math.max(minPx, cap);
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
  }, [ref, max, minPx, content]);
}

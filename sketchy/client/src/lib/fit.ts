import { useLayoutEffect, useState, type RefObject } from 'react';

/** How far `useShrinkToFit` may scale text down (0.6 of its size). */
export const FIT_MIN = 0.6;
const FIT_STEP = 0.92;

/**
 * The largest scale (≤ 1) at which content fits, in steps of 8 %, down to `FIT_MIN`. `overflows`
 * applies a scale and says whether the content still overflows at it.
 */
export function fitScale(overflows: (scale: number) => boolean): number {
  let scale = 1;
  while (overflows(scale) && scale > FIT_MIN) scale = Math.max(FIT_MIN, scale * FIT_STEP);
  return scale;
}

/**
 * Scales the text in `box` down (through its `--fit` custom property, which its font size
 * multiplies by) until nothing in it overflows, so a full room's reveal rows are never cut off.
 * Measured again when `key` changes, when the box changes size and when the fonts arrive.
 */
export function useShrinkToFit(box: RefObject<HTMLElement | null>, key: string): void {
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    let live = true;
    const fit = () => {
      if (!live) return;
      el.style.removeProperty('--fit');
      fitScale((scale) => {
        el.style.setProperty('--fit', String(scale));
        return el.scrollHeight > el.clientHeight + 1;
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    void document.fonts?.ready.then(fit);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [box, key]);
}

/** One canvas context for every measurement. */
let measurer: CanvasRenderingContext2D | null | undefined;

/**
 * The width of `text` in Nunito 900 capitals, in em (its widest word unless `oneLine`), measured
 * again once the font is in; null outside a browser. The reveal word is then as large as its page
 * allows rather than sized from a per-letter guess.
 */
export function useNunitoEm(text: string, oneLine: boolean): number | null {
  const [em, setEm] = useState<number | null>(null);
  useLayoutEffect(() => {
    let live = true;
    const measure = () => {
      measurer ??= document.createElement('canvas').getContext('2d');
      const ctx = measurer;
      if (!ctx || !live) return;
      ctx.font = "900 100px 'Nunito'";
      // A phrase that wraps between words needs its widest word to fit; one on a line, all of it.
      const parts = oneLine ? [text.trim()] : text.split(/\s+/);
      setEm(Math.max(...parts.map((w) => ctx.measureText(w.toUpperCase()).width)) / 100);
    };
    measure();
    void document.fonts?.load("900 100px 'Nunito'").then(measure, () => undefined);
    return () => {
      live = false;
    };
  }, [text, oneLine]);
  return em;
}

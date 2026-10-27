import { useLayoutEffect, useRef, type RefObject } from 'react';

/** How long a row takes to slide to its new place. */
export const FLIP_MS = 700;

/** True when the viewer asked for less motion. jsdom has no `matchMedia`. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Slides each `[data-flip-key]` child of `container` from where it was on the last render to where
 * it is now (the FLIP technique), so a reordered list moves instead of jumping. `order` names the
 * current order; the hook runs whenever it changes. Rows seen for the first time do not move.
 * Nothing moves when the viewer prefers reduced motion.
 */
export function useFlip(container: RefObject<HTMLElement | null>, order: string): void {
  const rects = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const next = new Map<string, DOMRect>();
    const animate = !prefersReducedMotion();
    for (const row of root.querySelectorAll<HTMLElement>('[data-flip-key]')) {
      const key = row.dataset.flipKey!;
      const rect = row.getBoundingClientRect();
      next.set(key, rect);
      const before = rects.current.get(key);
      if (!before || !animate || typeof row.animate !== 'function') continue;
      const dx = before.left - rect.left;
      const dy = before.top - rect.top;
      if (dx === 0 && dy === 0) continue;
      row.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: FLIP_MS,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      });
    }
    rects.current = next;
  }, [container, order]);
}

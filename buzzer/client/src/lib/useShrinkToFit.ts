import { useLayoutEffect, useState, type RefObject } from 'react';

/** How many of each group's items fit, by the group's `data-fit-group` value (F100). */
export type FitCounts = Readonly<Record<string, number>>;

/**
 * Sets the element's font size to the largest value, at most `max` and at least `minPx`, at which
 * its content fits its height. `max` is a share of its own width, or `'css'` for the size its
 * classes give it, so it only ever shrinks. Sizes inside it written in `em` scale along.
 * It refits when the element is resized, when web fonts finish loading, and when `content` changes.
 * The Screen lobby uses it so every player chip stays above the bottom strip (F38), and the Screen's
 * question so its text stays above the answer (F52).
 *
 * With `overflow` on, content that does not fit even at `minPx` is cut instead (F100): it returns,
 * for each `[data-fit-group]` inside the element, how many of its `li` children to show, keeping
 * one item's room for a "+N more" in their place. Null while everything fits. A group with no
 * entry shows everything.
 */
export function useShrinkToFit(
  ref: RefObject<HTMLElement | null>,
  max: number | 'css',
  minPx: number,
  content: string,
  overflow = false,
): FitCounts | null {
  // The counts hold only for the content they were measured on.
  const [measured, setMeasured] = useState<{ content: string; counts: FitCounts } | null>(null);
  const counts = overflow && measured?.content === content ? measured.counts : null;
  const countsKey = counts ? JSON.stringify(counts) : '';

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const overflows = () => el.scrollHeight > el.clientHeight;
    const fitsAt = (px: number) => {
      el.style.fontSize = `${px}px`;
      return !overflows();
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
      if (fitsAt(lo) || !overflow) return;
      setMeasured({ content, counts: fittingCounts(el, null) });
    };

    let live = true;
    let refit = fit;
    if (counts) {
      // Already cut at `minPx`. If "+N more" took more room than the item it replaced, cut one
      // more. A resize or new fonts measure again from the whole list.
      el.style.fontSize = `${minPx}px`;
      if (overflows()) setMeasured({ content, counts: fittingCounts(el, counts) });
      refit = () => setMeasured(null);
    } else {
      fit();
    }
    // A cut list waits for fonts only if they are still loading: `ready` resolves at once
    // otherwise, and measuring again would undo the cut it just made.
    if (!counts || document.fonts?.status === 'loading') {
      void document.fonts?.ready.then(() => live && refit());
    }
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        live = false;
      };
    }
    // Only the element's own box is watched; the font size changes its content, never its box.
    // The observer also reports the box once when it starts: only a change of size refits, so a
    // cut list is not measured again for nothing.
    let size = `${el.clientWidth}x${el.clientHeight}`;
    const observer = new ResizeObserver(() => {
      const next = `${el.clientWidth}x${el.clientHeight}`;
      if (next === size) return;
      size = next;
      refit();
    });
    observer.observe(el);
    return () => {
      live = false;
      observer.disconnect();
    };
    // `counts` is read through `countsKey`, its value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, max, minPx, content, overflow, countsKey]);

  return counts;
}

/**
 * How many of each group's items end inside the element's box. A group that overflows keeps one
 * item fewer, for its "+N more". `previous` is set when already cut: an overflowing group then
 * gives up one more of what it showed.
 */
function fittingCounts(el: HTMLElement, previous: FitCounts | null): FitCounts {
  const bottom = el.getBoundingClientRect().bottom + 0.5;
  const counts: Record<string, number> = { ...previous };
  for (const group of el.querySelectorAll<HTMLElement>('[data-fit-group]')) {
    const key = group.dataset.fitGroup!;
    const items = [...group.children].filter((child) => child.tagName === 'LI');
    const inside = items.filter((item) => item.getBoundingClientRect().bottom <= bottom).length;
    if (inside === items.length) continue;
    counts[key] =
      previous?.[key] !== undefined ? Math.max(0, previous[key] - 1) : Math.max(0, inside - 1);
  }
  return counts;
}

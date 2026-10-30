// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShrinkToFit, type FitCounts } from './useShrinkToFit.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.head.querySelectorAll('style').forEach((style) => style.remove());
});

/**
 * jsdom has no layout, so the box is faked: `width` × `height` px, and its content is
 * `rowsAt(fontPx)` rows of 2 × the font size each.
 */
function fakeBox(
  el: HTMLElement,
  box: { width: number; height: number },
  rowsAt: (px: number) => number,
) {
  const font = () => parseFloat(el.style.fontSize);
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => box.width });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => box.height });
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => rowsAt(font()) * 2 * font(),
  });
}

function renderFit(
  box: { width: number; height: number },
  rowsAt: (px: number) => number,
  content = 'a',
  { max = 0.02, cssPx }: { max?: number | 'css'; cssPx?: number } = {},
) {
  function Fit({ content }: { content: string }) {
    const ref = useRef<HTMLUListElement>(null);
    useShrinkToFit(ref, max, 8, content);
    return (
      <ul
        // Stands in for a text class: the size the element has with no inline font size.
        className={cssPx === undefined ? undefined : 'sized'}
        ref={(el) => {
          if (el) fakeBox(el, box, rowsAt);
          ref.current = el;
        }}
      />
    );
  }
  if (cssPx !== undefined) {
    const style = document.createElement('style');
    style.textContent = `.sized { font-size: ${cssPx}px; }`;
    document.head.append(style);
  }
  const result = render(<Fit content={content} />);
  const list = result.container.querySelector('ul')!;
  return {
    px: () => parseFloat(list.style.fontSize),
    rerender: (next: string) => result.rerender(<Fit content={next} />),
  };
}

describe('useShrinkToFit', () => {
  it('uses the full size when the content fits at it', () => {
    // 2% of 1000 px = 20 px; 3 rows × 40 px = 120 px fits in 200.
    const { px } = renderFit({ width: 1000, height: 200 }, () => 3);
    expect(px()).toBe(20);
  });

  it('shrinks to the largest size that fits, to within half a pixel', () => {
    // 5 rows: fits while 10 × px <= 120, so at most 12 px.
    const { px } = renderFit({ width: 1000, height: 120 }, () => 5);
    expect(px()).toBeLessThanOrEqual(12);
    expect(px()).toBeGreaterThan(11.5);
  });

  it('never goes below the floor, even when nothing fits', () => {
    const { px } = renderFit({ width: 1000, height: 10 }, () => 50);
    expect(px()).toBe(8);
  });

  it('refits when the content changes', () => {
    let rows = 3;
    const { px, rerender } = renderFit({ width: 1000, height: 120 }, () => rows);
    expect(px()).toBe(20);
    rows = 6;
    rerender('a\nb');
    expect(px()).toBeLessThanOrEqual(10);
    expect(px()).toBeGreaterThan(9.5);
  });

  it('refits when the box is resized', () => {
    let observed: ResizeObserverCallback = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          observed = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const box = { width: 1000, height: 200 };
    const { px } = renderFit(box, () => 3);
    expect(px()).toBe(20);
    box.height = 60;
    act(() => observed([], {} as ResizeObserver));
    expect(px()).toBeLessThanOrEqual(10);
    expect(px()).toBeGreaterThan(9.5);
  });

  describe("'css': at most the size the classes give", () => {
    it('keeps the class size when the content fits, however wide the box', () => {
      const { px } = renderFit({ width: 5000, height: 200 }, () => 2, 'a', {
        max: 'css',
        cssPx: 30,
      });
      expect(px()).toBe(30);
    });

    it('shrinks below the class size when the content would not fit', () => {
      // 3 rows: fits while 6 × px <= 120, so at most 20 px.
      const { px } = renderFit({ width: 1000, height: 120 }, () => 3, 'a', {
        max: 'css',
        cssPx: 30,
      });
      expect(px()).toBeLessThanOrEqual(20);
      expect(px()).toBeGreaterThan(19.5);
    });

    it('measures the class size afresh on a refit, so a shrink does not stick', () => {
      let rows = 3;
      const { px, rerender } = renderFit({ width: 1000, height: 120 }, () => rows, 'a', {
        max: 'css',
        cssPx: 30,
      });
      expect(px()).toBeLessThanOrEqual(20);
      rows = 1;
      rerender('b');
      expect(px()).toBe(30);
    });

    it('refits when the box is squeezed, as the answer appearing below does', () => {
      let observed: ResizeObserverCallback = () => {};
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(callback: ResizeObserverCallback) {
            observed = callback;
          }
          observe() {}
          disconnect() {}
        },
      );
      const box = { width: 1000, height: 200 };
      const { px } = renderFit(box, () => 2, 'a', { max: 'css', cssPx: 30 });
      expect(px()).toBe(30);
      // 2 rows: fits while 4 × px <= 60, so at most 15 px.
      box.height = 60;
      act(() => observed([], {} as ResizeObserver));
      expect(px()).toBeLessThanOrEqual(15);
      expect(px()).toBeGreaterThan(14.5);
    });
  });
});

describe('useShrinkToFit with overflow (F100)', () => {
  /**
   * jsdom has no layout: the box is `height` px tall at its top, and each item of a group is a
   * 40px row of its own from the box's top, whatever the font size. An item marked `data-more`
   * takes `moreRows` rows, as a long "+N more" might wrap.
   */
  function renderCut(
    groups: Record<string, number>,
    box: { height: number },
    { overflow = true, moreRows = 1 }: { overflow?: boolean; moreRows?: number } = {},
  ) {
    const results: (FitCounts | null)[] = [];
    function Cut() {
      const ref = useRef<HTMLDivElement>(null);
      const counts = useShrinkToFit(ref, 0.02, 14, 'a', overflow);
      results.push(counts);
      return (
        <div ref={ref} data-box>
          {Object.entries(groups).map(([key, total]) => {
            const shown = counts?.[key] ?? total;
            return (
              <ul key={key} data-fit-group={key}>
                {Array.from({ length: Math.min(shown, total) }, (_, i) => (
                  <li key={i}>{i}</li>
                ))}
                {shown < total && <li data-more>+{total - shown} more</li>}
              </ul>
            );
          })}
        </div>
      );
    }
    const rowsOf = (li: Element) => (li.hasAttribute('data-more') ? moreRows : 1);
    const isBox = (el: Element) => el.hasAttribute('data-box');
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
      return isBox(this) ? box.height : 0;
    });
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => 1000);
    // Each group is a column of its own, so the box's content is as tall as its tallest group.
    vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
      if (!isBox(this)) return 0;
      const heights = [...this.children].map(
        (ul) => [...ul.children].reduce((sum, li) => sum + rowsOf(li), 0) * 40,
      );
      return Math.max(0, ...heights);
    });
    const rect = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (isBox(this)) return { ...rect.call(this), top: 0, bottom: box.height } as DOMRect;
      if (this.tagName === 'LI') {
        const before = [...this.parentElement!.children].slice(
          0,
          [...this.parentElement!.children].indexOf(this) + 1,
        );
        const bottom = before.reduce((sum, li) => sum + rowsOf(li), 0) * 40;
        return { ...rect.call(this), top: bottom - 40, bottom } as DOMRect;
      }
      return rect.call(this);
    });
    const result = render(<Cut />);
    const box_ = result.container.querySelector<HTMLElement>('[data-box]')!;
    return {
      counts: () => results.at(-1),
      items: (key: string) =>
        [...box_.querySelectorAll(`[data-fit-group="${key}"] > li`)].map((li) => li.textContent),
      px: () => parseFloat(box_.style.fontSize),
    };
  }

  afterEach(() => vi.restoreAllMocks());

  it('cuts nothing while everything fits', () => {
    const { counts, items } = renderCut({ all: 5 }, { height: 200 });
    expect(counts()).toBeNull();
    expect(items('all')).toHaveLength(5);
  });

  it('at the floor, keeps what fits less one, and "+N more" takes the last place', () => {
    const { counts, items, px } = renderCut({ all: 12 }, { height: 200 });
    expect(counts()).toEqual({ all: 4 });
    expect(items('all')).toEqual(['0', '1', '2', '3', '+8 more']);
    expect(px()).toBe(14);
  });

  it('cuts one more when "+N more" takes more room than the item it replaced', () => {
    const { counts, items } = renderCut({ all: 12 }, { height: 200 }, { moreRows: 2 });
    expect(counts()).toEqual({ all: 3 });
    expect(items('all')).toEqual(['0', '1', '2', '+9 more']);
  });

  it('cuts only the groups that do not fit', () => {
    const { items } = renderCut({ red: 8, blue: 4 }, { height: 200 });
    expect(items('red')).toEqual(['0', '1', '2', '3', '+4 more']);
    expect(items('blue')).toEqual(['0', '1', '2', '3']);
  });

  it('measures again from the whole list when the box is resized', () => {
    let observed: ResizeObserverCallback = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          observed = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const box = { height: 200 };
    const { counts, items } = renderCut({ all: 12 }, box);
    expect(counts()).toEqual({ all: 4 });
    box.height = 400;
    act(() => observed([], {} as ResizeObserver));
    expect(counts()).toEqual({ all: 9 });
    expect(items('all')).toHaveLength(10);
    // A report of the same size does not measure again.
    act(() => observed([], {} as ResizeObserver));
    expect(counts()).toEqual({ all: 9 });
  });

  it('without overflow never cuts, as before', () => {
    const { counts, items, px } = renderCut({ all: 12 }, { height: 200 }, { overflow: false });
    expect(counts()).toBeNull();
    expect(items('all')).toHaveLength(12);
    expect(px()).toBe(14);
  });
});

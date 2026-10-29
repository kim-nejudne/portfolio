// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShrinkToFit } from './useShrinkToFit.js';

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

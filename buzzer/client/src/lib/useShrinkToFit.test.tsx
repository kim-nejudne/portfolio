// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShrinkToFit } from './useShrinkToFit.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
) {
  function Fit({ content }: { content: string }) {
    const ref = useRef<HTMLUListElement>(null);
    useShrinkToFit(ref, 0.02, 8, content);
    return (
      <ul
        ref={(el) => {
          if (el) fakeBox(el, box, rowsAt);
          ref.current = el;
        }}
      />
    );
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
});

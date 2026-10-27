// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FLIP_MS, useFlip } from './useFlip.js';

const ROW_HEIGHT = 50;

function List({ order }: { order: string[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useFlip(ref, order.join(','));
  return (
    <ol ref={ref}>
      {order.map((id) => (
        <li key={id} data-flip-key={id}>
          {id}
        </li>
      ))}
    </ol>
  );
}

/** jsdom has no layout: each row reports a box from its position in the list. */
function layoutRowsByIndex() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const index = [...(this.parentElement?.children ?? [])].indexOf(this);
    return new DOMRect(0, index * ROW_HEIGHT, 100, ROW_HEIGHT);
  });
}

/** Records the slide each row starts, keyed by its text. */
function recordSlides() {
  const slides = new Map<string, string>();
  const animate = vi.fn(function (this: HTMLElement, frames: Keyframe[]) {
    slides.set(this.textContent ?? '', String(frames[0]?.transform));
    return {} as Animation;
  });
  Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
  return slides;
}

function stubReducedMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: reduce && query.includes('reduce') }),
  });
}

beforeEach(layoutRowsByIndex);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('useFlip', () => {
  it('slides each moved row from its old place to its new one', () => {
    const slides = recordSlides();
    const { rerender } = render(<List order={['a', 'b', 'c']} />);
    expect(slides.size).toBe(0);

    rerender(<List order={['c', 'a', 'b']} />);
    expect(Object.fromEntries(slides)).toEqual({
      c: `translate(0px, ${2 * ROW_HEIGHT}px)`,
      a: `translate(0px, ${-ROW_HEIGHT}px)`,
      b: `translate(0px, ${-ROW_HEIGHT}px)`,
    });
  });

  it('leaves rows that did not move, and new rows, where they are', () => {
    const slides = recordSlides();
    const { rerender } = render(<List order={['a', 'b']} />);
    rerender(<List order={['a', 'b', 'c']} />);
    expect(slides.size).toBe(0);
  });

  it('moves nothing when the viewer prefers reduced motion', () => {
    stubReducedMotion(true);
    const slides = recordSlides();
    const { rerender } = render(<List order={['a', 'b', 'c']} />);
    rerender(<List order={['c', 'b', 'a']} />);
    expect(slides.size).toBe(0);
  });

  it('slides over FLIP_MS', () => {
    stubReducedMotion(false);
    recordSlides();
    const { rerender } = render(<List order={['a', 'b']} />);
    rerender(<List order={['b', 'a']} />);
    const animate = HTMLElement.prototype.animate as unknown as ReturnType<typeof vi.fn>;
    expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: FLIP_MS });
  });
});

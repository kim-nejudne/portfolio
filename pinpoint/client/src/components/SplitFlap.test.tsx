// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FLAP_GLYPHS, SplitFlap } from './SplitFlap.js';

const cells = () =>
  [...screen.getByRole('img').children].map((c) => (c as HTMLElement).textContent);
const shown = () => cells().join('');
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

function reducedMotion(on: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: on && query === '(prefers-reduced-motion: reduce)',
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('SplitFlap', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('cycles set glyphs at 70 ms, cells 25 ms apart, and a 22-cell prompt settles within 1.6 s', () => {
    // The shortest (6 glyphs) and longest (14) cycles, with Math.random pinned at each end.
    for (const r of [0, 0.999]) {
      vi.spyOn(Math, 'random').mockReturnValue(r);
      const text = 'CIUDAD DEL ESTE PARAGU';
      const { unmount } = render(<SplitFlap text={text} label="Prompt" cellClass="" />);
      expect(shown()).toBe(' '.repeat(22)); // blank before the first flip
      advance(0);
      // Cell 0 has started, cell 1 starts 25 ms later.
      expect(cells()[0]).not.toBe(' ');
      expect(FLAP_GLYPHS).toContain(cells()[0]);
      expect(cells()[1]).toBe(' ');
      advance(25);
      expect(FLAP_GLYPHS).toContain(cells()[1]);
      // Each cell flips for at least 6 × 70 ms after it starts before showing its target.
      advance(6 * 70 - 1 - 25);
      expect(cells()[0]).not.toBe('C');
      advance(21 * 25);
      expect(cells()[21]).not.toBe('U');
      advance(1600 - (21 * 25 + 6 * 70 - 1));
      expect(shown()).toBe(text);
      unmount();
    }
  });

  it('flips a character outside the set straight to itself on its last step', () => {
    render(<SplitFlap text="É/×" cellClass="" />);
    const seen = new Set<string>();
    for (let t = 0; t <= 1600; t += 5) {
      seen.add(shown());
      advance(5);
    }
    // Each cell is only ever blank or its own character.
    for (const s of seen)
      for (const [i, c] of [...s].entries()) expect([' ', 'É/×'[i]]).toContain(c);
    expect(shown()).toBe('É/×');
  });

  it('flips only the cells whose character changed, and lower-case names settle as typed', () => {
    const { rerender } = render(<SplitFlap text="ROUND 3" cellClass="" />);
    advance(1600);
    rerender(<SplitFlap text="ROUND 2" cellClass="" />);
    advance(0);
    expect(cells().slice(0, 6).join('')).toBe('ROUND ');
    expect(cells()[6]).not.toBe('2');
    advance(1600);
    expect(shown()).toBe('ROUND 2');
    rerender(<SplitFlap text="kim" tone="text" cellClass="" />);
    advance(1600);
    expect(shown()).toBe('kim'); // uppercased by the board face in CSS
  });

  it('a quick row (3-2-1) settles after 6 glyphs, inside its second', () => {
    render(<SplitFlap text="3" quick cellClass="" />);
    advance(6 * 70 - 1);
    expect(shown()).not.toBe('3');
    advance(1);
    expect(shown()).toBe('3');
  });

  it('reduced motion shows the text at once with the 150 ms fade, replayed on a change', () => {
    reducedMotion(true);
    const { rerender } = render(<SplitFlap text="ABCD" cellClass="" />);
    const first = screen.getByRole('img');
    expect(shown()).toBe('ABCD');
    expect(first.className).toContain('flap-fade');
    rerender(<SplitFlap text="WXYZ" cellClass="" />);
    expect(shown()).toBe('WXYZ');
    expect(screen.getByRole('img')).not.toBe(first); // remounted, so the fade runs again
  });

  it('reads as its label, with the seam on every cell and the tone on the row', () => {
    render(
      <SplitFlap text="PINPOINT" label="Pinpoint" tone="delayed" cellClass="h-[104px] w-[72px]" />,
    );
    const row = screen.getByRole('img', { name: 'Pinpoint' });
    expect(row.className).toContain('text-delayed');
    expect(row.className).toContain('gap-1.5');
    for (const cell of row.children) {
      expect(cell.getAttribute('aria-hidden')).toBe('true');
      expect(cell.className).toContain('h-[104px] w-[72px]');
      expect(cell.querySelector('.bg-flap-seam')!.className).toContain('h-0.5');
    }
  });
});

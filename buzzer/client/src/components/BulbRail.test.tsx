// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BulbRail } from './BulbRail.js';

afterEach(cleanup);

describe('BulbRail', () => {
  it('renders the asked number of bulbs, hidden from assistive tech', () => {
    const { container } = render(<BulbRail count={9} variant="row" />);
    const rail = container.firstElementChild as HTMLElement;
    expect(rail.getAttribute('aria-hidden')).toBe('true');
    expect(rail.children).toHaveLength(9);
  });

  it('staggers the chase so neighbouring bulbs dim in sequence, repeating every sixth bulb', () => {
    const { container } = render(<BulbRail count={8} />);
    const delays = [...container.firstElementChild!.children].map(
      (bulb) => (bulb as HTMLElement).style.animationDelay,
    );
    expect(delays.slice(0, 3)).toEqual(['0ms', `${1600 / 6}ms`, `${3200 / 6}ms`]);
    expect(delays[6]).toBe(delays[0]);
  });

  it('runs the chase only when motion is allowed', () => {
    const { container } = render(<BulbRail count={1} />);
    const bulb = container.firstElementChild!.firstElementChild!;
    expect(bulb.className).toContain('motion-safe:animate-bulb-chase');
    expect(bulb.className).not.toMatch(/(^|\s)animate-bulb-chase/);
  });
});

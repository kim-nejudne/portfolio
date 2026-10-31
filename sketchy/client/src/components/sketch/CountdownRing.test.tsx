// The countdown ring (F56): the value arc is the fraction of time left, it turns red pen in the
// last 10 s of a turn, and while choosing it counts down the 12 s choice without turning red.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CHOOSE_MS, LAST_SECONDS_MS } from '../../../../shared/constants.js';
import { CountdownRing, ringState } from './CountdownRing.js';

describe('ringState', () => {
  it('is the fraction of time left, with the seconds rounded up', () => {
    expect(ringState(30_000, 60_000, false)).toEqual({ fraction: 0.5, low: false, seconds: 30 });
    expect(ringState(29_001, 60_000, false).seconds).toBe(30);
  });

  it('clamps to 0..1 and never shows negative seconds', () => {
    expect(ringState(-500, 60_000, false)).toMatchObject({ fraction: 0, seconds: 0 });
    expect(ringState(90_000, 60_000, false)).toMatchObject({ fraction: 1 });
    expect(ringState(5_000, 0, false).fraction).toBe(0);
  });

  it('turns low in the last 10 s of a turn', () => {
    expect(ringState(LAST_SECONDS_MS + 1, 60_000, false).low).toBe(false);
    expect(ringState(LAST_SECONDS_MS, 60_000, false).low).toBe(true);
    expect(ringState(1_000, 60_000, false).low).toBe(true);
  });

  it('counts the 12 s choice while choosing and never turns low', () => {
    expect(CHOOSE_MS).toBe(12_000);
    expect(ringState(6_000, 60_000, true)).toEqual({ fraction: 0.5, low: false, seconds: 6 });
    expect(ringState(2_000, 12_000, true).low).toBe(false);
  });
});

describe('<CountdownRing>', () => {
  it('draws the arc as the fraction of 100 and the seconds in the middle', () => {
    const html = renderToStaticMarkup(
      <CountdownRing remainingMs={45_000} totalMs={60_000} size="58px" />,
    );
    expect(html).toContain('stroke-dasharray="75 100"');
    expect(html).toContain('>45</span>');
    expect(html).toContain('width:58px');
    expect(html).toContain('stroke-pen');
    expect(html).not.toContain('stroke-red');
  });

  it('is red pen when low', () => {
    const html = renderToStaticMarkup(
      <CountdownRing remainingMs={9_000} totalMs={60_000} size="58px" />,
    );
    expect(html).toContain('stroke-red');
    expect(html).toContain('data-low="true"');
  });

  it('stays ballpoint blue in the last seconds of choosing', () => {
    const html = renderToStaticMarkup(
      <CountdownRing remainingMs={3_000} totalMs={CHOOSE_MS} choosing size="58px" />,
    );
    expect(html).toContain('stroke-dasharray="25 100"');
    expect(html).not.toContain('stroke-red');
  });
});

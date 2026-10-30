import { describe, expect, it } from 'vitest';
import { translator } from './copy.js';
import { countdownDigit, pauseLine } from './pause.js';

const t = translator('en');

describe('pauseLine', () => {
  it('says the host paused it', () => {
    expect(pauseLine({ reasons: ['host'], resumeInMs: null }, 'Mika', t)).toBe(
      'The host paused the game',
    );
  });

  it('names what the room waits on first when there are several reasons', () => {
    expect(pauseLine({ reasons: ['host', 'drawerAway'], resumeInMs: null }, 'Mika', t)).toBe(
      'Waiting for Mika’s phone…',
    );
    expect(pauseLine({ reasons: ['host', 'screenAway'], resumeInMs: null }, null, t)).toBe(
      'Waiting for the Screen…',
    );
  });

  it('has no line during the 3-2-1', () => {
    expect(pauseLine({ reasons: [], resumeInMs: 2500 }, 'Mika', t)).toBeNull();
  });
});

describe('countdownDigit', () => {
  it('counts 3, 2, 1 and never shows 0', () => {
    expect([3000, 2001, 2000, 1001, 1000, 1, 0].map(countdownDigit)).toEqual([3, 3, 2, 2, 1, 1, 1]);
  });
});

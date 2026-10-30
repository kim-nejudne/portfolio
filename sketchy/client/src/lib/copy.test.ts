import { describe, expect, it } from 'vitest';
import { translator } from './copy.js';

describe('copy', () => {
  it('fills placeholders from the values given', () => {
    expect(translator('en')('waitingForHostToStart', { name: 'Mika' })).toBe(
      'Waiting for 👑 Mika to start',
    );
  });

  it('leaves a placeholder it has no value for, so a missing value is visible', () => {
    expect(translator('en')('gotIt')).toBe('{name} got it!');
  });
});

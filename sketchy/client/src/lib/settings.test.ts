import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../shared/constants.js';
import { presetOf } from './settings.js';

describe('presetOf', () => {
  it('names Classic for the defaults', () => {
    expect(presetOf(DEFAULT_SETTINGS)).toBe('classic');
  });

  it('names Quick and Barkada Night from their time, rounds and hints', () => {
    expect(presetOf({ ...DEFAULT_SETTINGS, drawSeconds: 45, cycles: 1 })).toBe('quick');
    expect(presetOf({ ...DEFAULT_SETTINGS, drawSeconds: 80, cycles: 3 })).toBe('barkadaNight');
  });

  it('ignores the settings no preset sets', () => {
    expect(presetOf({ ...DEFAULT_SETTINGS, words: 'en', spicy: true, guessFeed: 'off' })).toBe(
      'classic',
    );
  });

  it('is null once a preset value is changed by hand', () => {
    expect(presetOf({ ...DEFAULT_SETTINGS, drawSeconds: 100 })).toBeNull();
    expect(presetOf({ ...DEFAULT_SETTINGS, hints: false })).toBeNull();
  });
});

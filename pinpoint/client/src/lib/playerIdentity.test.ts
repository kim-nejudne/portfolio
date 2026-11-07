// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { clearPlayer, loadPlayer, newPlayerKey, savePlayer } from './playerIdentity.js';

afterEach(() => localStorage.clear());

describe('playerIdentity', () => {
  it('makes distinct 21-character keys in the URL-safe alphabet', () => {
    const a = newPlayerKey();
    expect(a).toMatch(/^[\w-]{21}$/);
    expect(newPlayerKey()).not.toBe(a);
  });

  it('saves, loads and clears per room code', () => {
    const identity = { playerKey: newPlayerKey(), name: 'Mika', emoji: '🦊' } as const;
    savePlayer('ABCD', identity);
    expect(loadPlayer('ABCD')).toEqual(identity);
    expect(loadPlayer('WXYZ')).toBeNull();
    clearPlayer('ABCD');
    expect(loadPlayer('ABCD')).toBeNull();
  });

  it('ignores unreadable or invalid entries', () => {
    for (const raw of ['{', 'null', '{"playerKey":"short","name":"A","emoji":"🦊"}']) {
      localStorage.setItem('pinpoint:player:ABCD', raw);
      expect(loadPlayer('ABCD')).toBeNull();
    }
    localStorage.setItem(
      'pinpoint:player:ABCD',
      JSON.stringify({ playerKey: newPlayerKey(), name: 'Mika', emoji: '🍕' }),
    );
    expect(loadPlayer('ABCD')).toBeNull();
  });
});

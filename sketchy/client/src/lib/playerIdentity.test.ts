import { describe, expect, it } from 'vitest';
import { playerKeySchema } from '../../../shared/schemas.js';
import { clearPlayer, loadPlayer, newPlayerKey, savePlayer } from './playerIdentity.js';

function memoryStore() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('playerIdentity', () => {
  it('makes keys the server accepts, different every time', () => {
    const keys = new Set(Array.from({ length: 50 }, newPlayerKey));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(playerKeySchema.safeParse(key).success).toBe(true);
  });

  it('keeps {playerKey, name} per room code, so a refresh rejoins as the same player', () => {
    const store = memoryStore();
    const kprw = { playerKey: newPlayerKey(), name: 'Jun' };
    savePlayer('KPRW', kprw, store);
    expect(loadPlayer('KPRW', store)).toEqual(kprw);
    expect(loadPlayer('ABCD', store)).toBeNull();
    clearPlayer('KPRW', store);
    expect(loadPlayer('KPRW', store)).toBeNull();
  });

  it('ignores an unreadable or tampered entry', () => {
    const store = memoryStore();
    store.setItem('sketchy:player:KPRW', '{not json');
    expect(loadPlayer('KPRW', store)).toBeNull();
    store.setItem('sketchy:player:KPRW', JSON.stringify({ playerKey: 'short', name: 'Jun' }));
    expect(loadPlayer('KPRW', store)).toBeNull();
    store.setItem('sketchy:player:KPRW', JSON.stringify({ playerKey: newPlayerKey(), name: '' }));
    expect(loadPlayer('KPRW', store)).toBeNull();
  });

  it('works without storage', () => {
    expect(() =>
      savePlayer('KPRW', { playerKey: newPlayerKey(), name: 'Jun' }, null),
    ).not.toThrow();
    expect(loadPlayer('KPRW', null)).toBeNull();
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadPlayer('KPRW', throwing)).toBeNull();
    expect(() => clearPlayer('KPRW', throwing)).not.toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { playerKeySchema } from '../../../shared/schemas.js';
import { AVATARS } from '../../../shared/constants.js';
import {
  clearPlayer,
  loadPlayer,
  newPlayerKey,
  randomAvatar,
  saveAvatar,
  savePlayer,
} from './playerIdentity.js';

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

  it('keeps {playerKey, name, avatar} per room code, so a refresh rejoins as the same player', () => {
    const store = memoryStore();
    const kprw = { playerKey: newPlayerKey(), name: 'Jun', avatar: '🐙' as const };
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

  it('keeps an entry without an avatar, or with one no longer offered, and picks a random one (F53)', () => {
    const store = memoryStore();
    const playerKey = newPlayerKey();
    for (const entry of [
      { playerKey, name: 'Jun' },
      { playerKey, name: 'Jun', avatar: '💩' },
      { playerKey, name: 'Jun', avatar: 7 },
    ]) {
      store.setItem('sketchy:player:KPRW', JSON.stringify(entry));
      const loaded = loadPlayer('KPRW', store);
      expect(loaded).toMatchObject({ playerKey, name: 'Jun' });
      expect(AVATARS).toContain(loaded?.avatar);
    }
  });

  it('pre-picks any of the 24 avatars, first to last', () => {
    expect(randomAvatar(() => 0)).toBe(AVATARS[0]);
    expect(randomAvatar(() => 0.999999)).toBe(AVATARS[23]);
    for (let i = 0; i < 20; i++) expect(AVATARS).toContain(randomAvatar());
  });

  it('works without storage', () => {
    expect(() =>
      savePlayer('KPRW', { playerKey: newPlayerKey(), name: 'Jun', avatar: '🦊' }, null),
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

  it('stores a changed avatar in the identity the page holds and in storage (F54)', () => {
    const store = memoryStore();
    const identity = {
      playerKey: newPlayerKey(),
      name: 'Jun',
      avatar: '🐙' as (typeof AVATARS)[number],
    };
    savePlayer('KPRW', identity, store);
    saveAvatar('KPRW', identity, '🚀', store);
    // The same object: a join in flight still recognises it.
    expect(identity.avatar).toBe('🚀');
    expect(loadPlayer('KPRW', store)).toEqual({ ...identity, avatar: '🚀' });
  });
});

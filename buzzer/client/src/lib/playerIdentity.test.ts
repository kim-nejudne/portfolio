// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { idSchema } from '../../../shared/schemas.js';
import {
  clearPlayer,
  loadPlayer,
  newPlayerId,
  renamePlayer,
  savePlayer,
} from './playerIdentity.js';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('player identity', () => {
  it('stores the playerId and name per room code', () => {
    savePlayer('ABCD', { playerId: 'id-a', name: 'Ana' });
    savePlayer('WXYZ', { playerId: 'id-w', name: 'Wes' });
    expect(loadPlayer('ABCD')).toEqual({ playerId: 'id-a', name: 'Ana' });
    expect(loadPlayer('WXYZ')).toEqual({ playerId: 'id-w', name: 'Wes' });
  });

  it('returns null for a room this device never joined', () => {
    expect(loadPlayer('ABCD')).toBeNull();
  });

  it('clearPlayer forgets only that room', () => {
    savePlayer('ABCD', { playerId: 'id-a', name: 'Ana' });
    savePlayer('WXYZ', { playerId: 'id-w', name: 'Wes' });
    clearPlayer('ABCD');
    expect(loadPlayer('ABCD')).toBeNull();
    expect(loadPlayer('WXYZ')).not.toBeNull();
  });

  it('renamePlayer keeps the playerId and stores the new name', () => {
    savePlayer('ABCD', { playerId: 'id-a', name: 'Ana' });
    renamePlayer('ABCD', 'Annie');
    expect(loadPlayer('ABCD')).toEqual({ playerId: 'id-a', name: 'Annie' });
  });

  it('renamePlayer stores nothing for a room this device never joined', () => {
    renamePlayer('ABCD', 'Annie');
    expect(loadPlayer('ABCD')).toBeNull();
  });

  it('ignores an unreadable or invalid stored entry', () => {
    localStorage.setItem('buzzr:player:ABCD', '{not json');
    localStorage.setItem('buzzr:player:WXYZ', JSON.stringify({ playerId: 'a b', name: '' }));
    expect(loadPlayer('ABCD')).toBeNull();
    expect(loadPlayer('WXYZ')).toBeNull();
  });

  it('works without storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => savePlayer('ABCD', { playerId: 'id-a', name: 'Ana' })).not.toThrow();
    expect(loadPlayer('ABCD')).toBeNull();
  });

  it('new playerIds are unique and pass the server id schema', () => {
    const ids = Array.from({ length: 100 }, newPlayerId);
    expect(new Set(ids).size).toBe(100);
    for (const id of ids) expect(idSchema.safeParse(id).success).toBe(true);
  });
});

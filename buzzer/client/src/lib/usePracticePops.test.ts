// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Fx } from '../../../shared/types.js';
import { resetRoomStore, useRoomStore } from './roomStore.js';
import { usePracticePops } from './usePracticePops.js';

afterEach(resetRoomStore);

/** Stores `fx` as the socket handler does: the next sequence number. */
const fire = (fx: Fx) =>
  act(() => useRoomStore.setState((state) => ({ fx: { fx, seq: (state.fx?.seq ?? 0) + 1 } })));

describe('usePracticePops', () => {
  it('records each player’s latest test buzz, keeping the others', () => {
    const { result } = renderHook(() => usePracticePops());
    fire({ kind: 'practice', playerId: 'p1' });
    fire({ kind: 'practice', playerId: 'p2' });
    fire({ kind: 'practice', playerId: 'p1' });
    expect([...result.current]).toEqual([
      ['p1', 3],
      ['p2', 2],
    ]);
  });

  it('ignores every other fx kind', () => {
    const { result } = renderHook(() => usePracticePops());
    fire({ kind: 'join', playerId: 'p1' });
    expect(result.current.size).toBe(0);
  });

  it('never replays a test buzz already in the store when it mounts', () => {
    fire({ kind: 'practice', playerId: 'p1' });
    const { result } = renderHook(() => usePracticePops());
    expect(result.current.size).toBe(0);
    fire({ kind: 'practice', playerId: 'p1' });
    expect(result.current.get('p1')).toBe(2);
  });
});

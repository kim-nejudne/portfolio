import { describe, expect, it } from 'vitest';
import { EMOJI } from '#shared/constants.js';
import type { Room } from '#shared/types.js';
import { playerIdentity, reduce } from './reducer.js';
import { createRoom } from './roomStore.js';
import { toView, vipControls } from './views.js';

const CODE = 'ABCD';
const T0 = 1_000_000;
const CTX = { now: T0 + 500, publicUrl: 'https://pinpoint.example' };
const key = (n: number) => `secret-key-${String(n).padStart(10, '0')}`;
const idOf = (n: number) => playerIdentity(CODE, key(n)).id;

/** A lobby with players 1…n; player 1 is the VIP. */
function lobby(n: number): Room {
  let room = createRoom(CODE, T0, 7);
  for (let i = 1; i <= n; i++) {
    const res = reduce(
      room,
      { type: 'player:join', playerKey: key(i), name: `P${i}`, emoji: EMOJI[i]! },
      T0 + i,
    );
    expect(res.error).toBeUndefined();
    room = res.room;
  }
  return room;
}

describe('lobby views', () => {
  it('carry no player key or key hash, in any role', () => {
    const room = lobby(3);
    const views = [
      toView(room, 'screen', undefined, CTX),
      ...[1, 2, 3].map((n) => toView(room, 'player', idOf(n), CTX)),
    ];
    for (const view of views) {
      const json = JSON.stringify(view);
      for (const n of [1, 2, 3]) {
        expect(json).not.toContain(key(n));
        expect(json).not.toContain(playerIdentity(CODE, key(n)).keyHash);
      }
      expect(json).not.toContain('keyHash');
    }
  });

  it('give the Screen the code, join URL, serverNow, players and settings', () => {
    const view = toView(lobby(2), 'screen', undefined, CTX);
    expect(view).toMatchObject({
      role: 'screen',
      serverNow: CTX.now,
      code: CODE,
      joinUrl: 'https://pinpoint.example/play/ABCD',
      phase: 'LOBBY',
      settings: { mode: 'name', difficulty: 'mixed', rounds: 10, timerSeconds: 30 },
      region: null,
      round: null,
      reveal: null,
    });
    expect(view.players.map((p) => [p.name, p.isVip, p.total, p.rank])).toEqual([
      ['P1', true, 0, 1],
      ['P2', false, 0, 1],
    ]);
  });

  it("add settings, the player list and lobby controls to the VIP's view only", () => {
    const room = lobby(2);
    const vip = toView(room, 'player', idOf(1), CTX);
    expect(vip).toMatchObject({
      role: 'player',
      serverNow: CTX.now,
      vipName: 'P1',
      playerCount: 2,
    });
    expect(vip.me.id).toBe(idOf(1));
    expect(vip.vip?.controls).toEqual(['start', 'kick']);
    expect(vip.vip?.players.map((p) => p.id)).toEqual([idOf(1), idOf(2)]);
    expect(vip.settings).toEqual(room.settings);

    const other = toView(room, 'player', idOf(2), CTX);
    expect(other.vip).toBeNull();
    expect(other.me.id).toBe(idOf(2));
    expect(other.vipName).toBe('P1');
  });

  it('refuse to build a view for a player who is not in the room', () => {
    expect(() => toView(lobby(1), 'player', 'nobody', CTX)).toThrow();
  });
});

describe('vipControls', () => {
  it('follows the spec table per phase', () => {
    expect(vipControls('GUESSING', false, false)).toEqual(['pause', 'skipRound', 'kick', 'end']);
    expect(vipControls('REVEAL', true, false)).toEqual(['next', 'resume', 'skipRound', 'end']);
    expect(vipControls('SCOREBOARD', false, false)).toContain('roundSettings');
    expect(vipControls('FINAL', false, true)).toEqual(['rematchCancel']);
    expect(vipControls('FINAL', false, false)).toEqual(['rematch', 'backToLobby', 'kick']);
  });
});

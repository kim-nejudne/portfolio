// Changing your avatar in the lobby (F54): `player:avatar`, LOBBY only, the sender's own player.
import { describe, expect, it } from 'vitest';
import { reduce } from './reducer.js';
import { SCREEN, SCREEN_HOST, T0, asPlayer, inPhase, step, withPlayers } from './test/rooms.js';

describe('player:avatar', () => {
  it('changes the sender’s own avatar and no one else’s', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const [ana, ben] = [pids[0]!, pids[1]!];
    const { room: after, effects } = step(
      room,
      { type: 'player:avatar', by: asPlayer(ana), avatar: '🐙' },
      T0 + 10,
    );
    expect(after.players[ana]!.avatar).toBe('🐙');
    expect(after.players[ben]!.avatar).toBe(room.players[ben]!.avatar);
    expect(effects).toEqual([]);
  });

  it('lets the crown holder change theirs too, and two players share one', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const [ana, ben] = [pids[0]!, pids[1]!];
    const first = step(room, { type: 'player:avatar', by: asPlayer(ana, true), avatar: '🐸' }, T0);
    const { room: after } = step(
      first.room,
      { type: 'player:avatar', by: asPlayer(ben), avatar: '🐸' },
      T0 + 1,
    );
    expect([after.players[ana]!.avatar, after.players[ben]!.avatar]).toEqual(['🐸', '🐸']);
  });

  for (const phase of ['CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD', 'FINAL'] as const) {
    it(`is refused in ${phase} with no change`, () => {
      const room = inPhase(phase);
      const pid = Object.keys(room.players)[0]!;
      expect(reduce(room, { type: 'player:avatar', by: asPlayer(pid), avatar: '🐙' }, T0)).toEqual({
        ok: false,
        error: 'wrongPhase',
      });
    });
  }

  it('is refused from a Screen, with or without the token', () => {
    const { room } = withPlayers(['Ana', 'Ben']);
    for (const by of [SCREEN, SCREEN_HOST])
      expect(reduce(room, { type: 'player:avatar', by, avatar: '🐙' }, T0)).toEqual({
        ok: false,
        error: 'notPlayer',
      });
  });

  it('is refused for a pid the room doesn’t know', () => {
    const { room } = withPlayers(['Ana']);
    expect(
      reduce(room, { type: 'player:avatar', by: asPlayer('p-gone'), avatar: '🐙' }, T0),
    ).toEqual({ ok: false, error: 'unknownPlayer' });
  });
});

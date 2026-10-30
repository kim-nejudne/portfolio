// Lobby doodles (F27): `sys:doodle` in the Actions table and "Lobby doodles" in docs/spec.md.
import { describe, expect, it } from 'vitest';
import type { Phase } from '../shared/types.js';
import { reduce } from './reducer.js';
import { toView } from './views.js';
import { T0, asPlayer, inPhase, step, withPlayers } from './test/rooms.js';

const doodle = (pid: string, has: boolean) => ({ type: 'sys:doodle', pid, has }) as const;

describe('sys:doodle', () => {
  it('sets hasDoodle in LOBBY, and every view carries it on that chip only', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const { room: next, effects } = step(room, doodle(pids[0]!, true), T0);
    expect(next.players[pids[0]!]!.hasDoodle).toBe(true);
    expect(next.players[pids[1]!]!.hasDoodle).toBe(false);
    expect(effects).toEqual([]);
    for (const view of [
      toView(next, { kind: 'screen', isHost: true }, T0),
      toView(next, { kind: 'player', pid: pids[1]! }, T0),
    ]) {
      const chips = Object.fromEntries(view.players.map((p) => [p.pid, p.hasDoodle]));
      expect(chips).toEqual({ [pids[0]!]: true, [pids[1]!]: false });
    }
    // Undoing every stroke clears it again.
    expect(step(next, doodle(pids[0]!, false), T0).room.players[pids[0]!]!.hasDoodle).toBe(false);
  });

  it.each<Exclude<Phase, 'LOBBY'>>(['CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD', 'FINAL'])(
    'refuses has: true in %s, and takes has: false there',
    (phase) => {
      const room = inPhase(phase);
      const pid = Object.keys(room.players)[0]!;
      expect(reduce(room, doodle(pid, true), T0 + 10_000)).toEqual({
        ok: false,
        error: 'wrongPhase',
      });
      const withDoodle = {
        ...room,
        players: { ...room.players, [pid]: { ...room.players[pid]!, hasDoodle: true } },
      };
      const res = step(withDoodle, doodle(pid, false), T0 + 10_000);
      expect(res.room.players[pid]!.hasDoodle).toBe(false);
      expect(res.room.phase).toBe(phase);
    },
  );

  it('refuses an unknown pid', () => {
    const { room } = withPlayers(['Ana']);
    expect(reduce(room, doodle('nobody', true), T0)).toEqual({
      ok: false,
      error: 'unknownPlayer',
    });
  });
});

describe('leaving drops the doodle', () => {
  it('player:leave asks the ink gateway to drop that doodle, in the lobby and mid-game', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    const lobby = step(room, { type: 'player:leave', by: asPlayer(pids[2]!) }, T0);
    expect(lobby.effects).toContainEqual({ type: 'doodleDrop', pid: pids[2] });
    const game = inPhase('DRAWING');
    const guesser = Object.keys(game.players).find((pid) => pid !== game.turn!.drawerPid)!;
    const res = step(game, { type: 'player:leave', by: asPlayer(guesser) }, T0 + 10_000);
    expect(res.effects).toContainEqual({ type: 'doodleDrop', pid: guesser });
  });

  it('a disconnect keeps it', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const withDoodle = step(room, doodle(pids[1]!, true), T0).room;
    const res = step(withDoodle, { type: 'sys:disconnected', pid: pids[1]! }, T0 + 1);
    expect(res.room.players[pids[1]!]!.hasDoodle).toBe(true);
    expect(res.effects.filter((e) => e.type === 'doodleDrop')).toEqual([]);
  });
});

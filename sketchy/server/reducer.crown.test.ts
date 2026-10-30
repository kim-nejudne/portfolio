// The host crown (F25): Roles and devices (Host crown) and the Actions table in docs/spec.md.
import { describe, expect, it } from 'vitest';
import type { Effect, Phase, Room } from '../shared/types.js';
import { reduce } from './reducer.js';
import { toView } from './views.js';
import {
  NEW_PHONE,
  SCREEN,
  SCREEN_HOST,
  T0,
  asPlayer,
  inPhase,
  step,
  withPlayers,
} from './test/rooms.js';

const crowned = (pid: string): Effect => ({ type: 'fx', to: { pid }, fx: { kind: 'crowned' } });
const crownFx = (effects: Effect[]) =>
  effects.filter((e) => e.type === 'fx' && e.fx.kind === 'crowned');
const pidOf = (room: Room, name: string) =>
  Object.values(room.players).find((p) => p.name === name)!.pid;

describe('the first joiner', () => {
  it('is crowned automatically and told so; later joiners are not', () => {
    const empty = withPlayers([]).room;
    const first = step(
      empty,
      { type: 'player:join', by: NEW_PHONE, keyHash: 'k-ana', name: 'Ana' },
      T0,
    );
    const ana = pidOf(first.room, 'Ana');
    expect(first.room.crownPid).toBe(ana);
    expect(first.effects).toContainEqual(crowned(ana));
    const second = step(
      first.room,
      { type: 'player:join', by: NEW_PHONE, keyHash: 'k-ben', name: 'Ben' },
      T0 + 1,
    );
    expect(second.room.crownPid).toBe(ana);
    expect(crownFx(second.effects)).toEqual([]);
  });
});

describe('host:crown', () => {
  it('lets the token Screen give the crown to any player, who gets `crowned`', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    const res = step(room, { type: 'host:crown', by: SCREEN_HOST, pid: pids[2]! }, T0 + 10);
    expect(res.room.crownPid).toBe(pids[2]);
    expect(res.effects).toEqual([crowned(pids[2]!)]);
  });

  it('lets the crown holder pass it on from their phone', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const res = step(
      room,
      { type: 'host:crown', by: asPlayer(pids[0]!, true), pid: pids[1]! },
      T0 + 10,
    );
    expect(res.room.crownPid).toBe(pids[1]);
    expect(res.effects).toEqual([crowned(pids[1]!)]);
  });

  it.each<Phase>(['LOBBY', 'CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD', 'FINAL'])(
    'works in %s, changing nothing but the crown',
    (phase) => {
      const room = phase === 'LOBBY' ? withPlayers(['Ana', 'Ben']).room : inPhase(phase);
      const ben = pidOf(room, 'Ben');
      const res = step(room, { type: 'host:crown', by: SCREEN_HOST, pid: ben }, T0 + 60_000);
      expect(res.room).toEqual({ ...room, crownPid: ben });
      expect(res.effects).toEqual([crowned(ben)]);
    },
  );

  it('refuses a player without the crown, a plain Screen, and a stale crown flag', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    const [ana, ben, cy] = pids as [string, string, string];
    const give = (by: typeof SCREEN, pid = cy) =>
      reduce(room, { type: 'host:crown', by, pid }, T0 + 10);
    expect(give(asPlayer(ben))).toEqual({ ok: false, error: 'notHost' });
    expect(give(SCREEN)).toEqual({ ok: false, error: 'notHost' });
    // The gateway's flag says host, but the reducer finds the crown elsewhere.
    expect(give(asPlayer(ben, true))).toEqual({ ok: false, error: 'notHost' });
    // Ana passed it on: her phone's next try is refused.
    const passed = step(room, { type: 'host:crown', by: asPlayer(ana, true), pid: ben }, T0 + 20);
    expect(
      reduce(passed.room, { type: 'host:crown', by: asPlayer(ana, true), pid: ana }, T0 + 30),
    ).toEqual({ ok: false, error: 'notHost' });
  });

  it('refuses a pid that is not in the room', () => {
    const { room } = withPlayers(['Ana', 'Ben']);
    expect(reduce(room, { type: 'host:crown', by: SCREEN_HOST, pid: 'pnobody00' }, T0)).toEqual({
      ok: false,
      error: 'unknownPlayer',
    });
  });

  it('changes nothing when given to the player who already holds it', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const res = step(room, { type: 'host:crown', by: SCREEN_HOST, pid: pids[0]! }, T0 + 10);
    expect(res.room).toEqual(room);
    expect(res.effects).toEqual([]);
  });

  it('may go to a disconnected player; the Screen can still move it again', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    const off = step(room, { type: 'sys:disconnected', pid: pids[1]! }, T0 + 5).room;
    const res = step(off, { type: 'host:crown', by: SCREEN_HOST, pid: pids[1]! }, T0 + 10);
    expect(res.room.crownPid).toBe(pids[1]);
    const back = step(res.room, { type: 'host:crown', by: SCREEN_HOST, pid: pids[0]! }, T0 + 20);
    expect(back.room.crownPid).toBe(pids[0]);
  });

  it('moves the host rights: the new holder can start, the old one cannot', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const [ana, ben] = pids as [string, string];
    const moved = step(room, { type: 'host:crown', by: SCREEN_HOST, pid: ben }, T0 + 10).room;
    expect(reduce(moved, { type: 'host:start', by: asPlayer(ana, true) }, T0 + 20)).toEqual({
      ok: false,
      error: 'notHost',
    });
    expect(step(moved, { type: 'host:start', by: asPlayer(ben, true) }, T0 + 20).room.phase).toBe(
      'CHOOSING',
    );
  });

  it('moves the host block between the two phones’ views, and nothing else', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const [ana, ben] = pids as [string, string];
    const moved = step(room, { type: 'host:crown', by: SCREEN_HOST, pid: ben }, T0 + 10).room;
    const before = { ana: toView(room, { kind: 'player', pid: ana }, T0) };
    const after = {
      ana: toView(moved, { kind: 'player', pid: ana }, T0),
      ben: toView(moved, { kind: 'player', pid: ben }, T0),
    };
    expect(before.ana.host).toEqual({ code: room.code, customWordCount: 0 });
    expect(after.ana.host).toBeNull();
    expect(after.ben.host).toEqual({ code: room.code, customWordCount: 0 });
    // The crown adds controls, never data: Ben's view is a plain view plus the host block.
    const plain = toView({ ...moved, crownPid: null }, { kind: 'player', pid: ben }, T0);
    expect({ ...after.ben, host: null, players: plain.players }).toEqual(plain);
  });
});

describe('the crown on leave, disconnect and takeover', () => {
  it('passes to the longest-connected remaining player when the holder leaves', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    const [ana, ben, cy] = pids as [string, string, string];
    // Ben, next in join order, is offline: Cy is the longest-connected remaining player.
    const off = step(room, { type: 'sys:disconnected', pid: ben }, T0 + 5).room;
    const res = step(off, { type: 'player:leave', by: asPlayer(ana, true) }, T0 + 10);
    expect(res.room.crownPid).toBe(cy);
    expect(res.effects).toContainEqual(crowned(cy));
  });

  it('passes to the earliest joiner when nobody else is connected', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    const [ana, ben, cy] = pids as [string, string, string];
    let r = step(room, { type: 'sys:disconnected', pid: ben }, T0 + 5).room;
    r = step(r, { type: 'sys:disconnected', pid: cy }, T0 + 6).room;
    expect(step(r, { type: 'player:leave', by: asPlayer(ana, true) }, T0 + 10).room.crownPid).toBe(
      ben,
    );
  });

  it('passes mid-game too, when the crowned drawer leaves', () => {
    const room = inPhase('DRAWING');
    const drawer = room.turn!.drawerPid;
    const crownedDrawer = { ...room, crownPid: drawer };
    const res = step(crownedDrawer, { type: 'player:leave', by: asPlayer(drawer, true) }, T0 + 1);
    const heir = Object.keys(res.room.players)[0]!;
    expect(res.room.crownPid).toBe(heir);
    expect(res.effects).toContainEqual(crowned(heir));
  });

  it('stays with a holder who disconnects, while the Screen can still act', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    const off = step(room, { type: 'sys:disconnected', pid: pids[0]! }, T0 + 5);
    expect(off.room.crownPid).toBe(pids[0]);
    expect(crownFx(off.effects)).toEqual([]);
    expect(step(off.room, { type: 'host:start', by: SCREEN_HOST }, T0 + 10).room.phase).toBe(
      'CHOOSING',
    );
  });

  it('stays with the player when a new phone takes them over', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const off = step(room, { type: 'sys:disconnected', pid: pids[0]! }, T0 + 5).room;
    const res = step(
      off,
      { type: 'player:join', by: NEW_PHONE, keyHash: 'new-phone', name: 'ana', takeOver: true },
      T0 + 10,
    );
    expect(res.room.crownPid).toBe(pids[0]);
  });
});

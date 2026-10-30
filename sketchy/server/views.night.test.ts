// The next game in views (F29): `gameNumber`, the rematch countdown's first drawer and the Screen's
// Tonight panel. Role views and UI by role and phase (Final) in docs/spec.md.
import { describe, expect, it } from 'vitest';
import type { Action, Effect, Room } from '../shared/types.js';
import { toView } from './views.js';
import { SCREEN_HOST, asPlayer, dealt, step } from './test/rooms.js';

const END: Action = { type: 'host:end', by: SCREEN_HOST };
const REMATCH: Action = { type: 'host:rematch', by: SCREEN_HOST };
const screen = (room: Room, now: number) => toView(room, { kind: 'screen', isHost: false }, now);

type Schedule = Extract<Effect, { type: 'schedule' }>;

/** Ana draws turn 1 of a 3-player game; `scorer` guesses it and the host ends the game. */
function final(scorer = 1) {
  const { room, pids, at } = dealt();
  let r = step(room, { type: 'drawer:choose', by: asPlayer(pids[0]!), index: 0 }, at).room;
  r = step(
    r,
    {
      type: 'player:guess',
      by: asPlayer(pids[scorer]!),
      text: r.turn!.word!.word,
      receivedAt: at + 5000,
      oneWayMs: 0,
    },
    at + 5000,
  ).room;
  return { room: step(r, END, at + 6000).room, pids, at: at + 10_000 };
}

function rematchGo(room: Room, t: number): Room {
  const res = step(room, REMATCH, t);
  const go = res.effects.find(
    (e): e is Schedule => e.type === 'schedule' && e.timer === 'rematchGo',
  )!;
  return step(
    res.room,
    { type: 'timer', timer: 'rematchGo', turnId: go.turnId, epoch: go.epoch },
    t + 3000,
  ).room;
}

describe('rematch countdown in views', () => {
  it('every view has the time left and the next first drawer; null with no countdown', () => {
    const { room, pids, at } = final();
    expect(screen(room, at)).toMatchObject({
      rematchInMs: null,
      rematchFirst: null,
      gameNumber: 1,
    });
    const counting = step(room, REMATCH, at).room;
    const ben = { pid: pids[1], name: 'Ben', color: counting.players[pids[1]!]!.color };
    expect(screen(counting, at + 1000)).toMatchObject({ rematchInMs: 2000, rematchFirst: ben });
    for (const pid of pids)
      expect(toView(counting, { kind: 'player', pid }, at + 1000)).toMatchObject({
        rematchInMs: 2000,
        rematchFirst: ben,
        gameNumber: 1,
      });
  });

  it('names the next connected player when Ben is away, and follows a leave', () => {
    const { room, pids, at } = final();
    const counting = step(room, REMATCH, at).room;
    const away = step(counting, { type: 'sys:disconnected', pid: pids[1]! }, at + 100).room;
    expect(screen(away, at + 200).rematchFirst?.name).toBe('Cy');
    const left = step(counting, { type: 'player:leave', by: asPlayer(pids[1]!) }, at + 100).room;
    expect(screen(left, at + 200).rematchFirst?.name).toBe('Cy');
  });

  it('names whoever the countdown then deals to, after a disconnect mid-countdown', () => {
    const { room, pids, at } = final();
    const res = step(room, REMATCH, at);
    const away = step(res.room, { type: 'sys:disconnected', pid: pids[1]! }, at + 100).room;
    const named = screen(away, at + 200).rematchFirst!.pid;
    const go = res.effects.find(
      (e): e is Schedule => e.type === 'schedule' && e.timer === 'rematchGo',
    )!;
    const game2 = step(
      away,
      { type: 'timer', timer: 'rematchGo', turnId: go.turnId, epoch: go.epoch },
      at + 3000,
    ).room;
    expect(game2.turn!.drawerPid).toBe(named);
  });
});

describe('Tonight panel', () => {
  it('is null in the first game and outside FINAL', () => {
    const { room, at } = final();
    expect(screen(room, at).tonight).toBeNull();
    const game2 = rematchGo(room, at);
    expect(game2.phase).toBe('CHOOSING');
    expect(screen(game2, at + 4000).tonight).toBeNull();
  });

  it('from game 2 ranks every finished game plus this one, players who left included', () => {
    // Game 1: Ben scores. Game 2 (Ben draws): Cy scores, then Ana leaves at FINAL.
    const one = final(1);
    const scoreBen1 = one.room.players[one.pids[1]!]!.score;
    let r = rematchGo(one.room, one.at);
    r = step(
      r,
      { type: 'drawer:choose', by: asPlayer(one.pids[1]!), index: 0 },
      one.at + 4000,
    ).room;
    r = step(
      r,
      {
        type: 'player:guess',
        by: asPlayer(one.pids[2]!),
        text: r.turn!.word!.word,
        receivedAt: one.at + 6000,
        oneWayMs: 0,
      },
      one.at + 6000,
    ).room;
    r = step(r, END, one.at + 7000).room;
    const cy = r.players[one.pids[2]!]!.score;
    const benDrawer = r.players[one.pids[1]!]!.score;
    r = step(r, { type: 'player:leave', by: asPlayer(one.pids[0]!) }, one.at + 8000).room;
    // Ana scored as game 1's drawer; she keeps her total, under her name, after leaving.
    const ana1 = one.room.players[one.pids[0]!]!.score;

    const rows = screen(r, one.at + 9000).tonight!;
    const byName = Object.fromEntries(rows.map((row) => [row.name, row.total]));
    expect(byName).toEqual({ Ana: ana1, Ben: scoreBen1 + benDrawer, Cy: cy });
    // Ranked by total, highest first; equal totals share a rank.
    const totals = rows.map((row) => row.total);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
    expect(rows[0]!.rank).toBe(1);
    expect(Object.keys(rows[0]!).sort()).toEqual(['color', 'name', 'pid', 'rank', 'total']);
  });

  it('only on the Screen: phone views have no Tonight panel', () => {
    const { room, pids, at } = final();
    const game2 = step(rematchGo(room, at), END, at + 4000).room;
    expect(screen(game2, at + 5000).tonight).not.toBeNull();
    expect('tonight' in toView(game2, { kind: 'player', pid: pids[0]! }, at + 5000)).toBe(false);
  });
});

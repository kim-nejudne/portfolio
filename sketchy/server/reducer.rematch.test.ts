// Rematch (F29): `host:rematch`, `host:rematchCancel` and `timer rematchGo`. Transitions and Turn
// order (Rematch rotation) in docs/spec.md.
import { describe, expect, it } from 'vitest';
import { REMATCH_COUNTDOWN_MS } from '../shared/constants.js';
import type { Action, Effect, Room } from '../shared/types.js';
import { reduce } from './reducer.js';
import {
  NEW_PHONE,
  SCREEN,
  SCREEN_HOST,
  asPlayer,
  dealt,
  inPhase,
  secretWord,
  step,
  withPlayers,
} from './test/rooms.js';

const REMATCH: Action = { type: 'host:rematch', by: SCREEN_HOST };
const CANCEL: Action = { type: 'host:rematchCancel', by: SCREEN_HOST };
const END: Action = { type: 'host:end', by: SCREEN_HOST };
const SKIP: Action = { type: 'host:skip', by: SCREEN_HOST };
const NEXT: Action = { type: 'host:next', by: SCREEN_HOST };

type Schedule = Extract<Effect, { type: 'schedule' }>;

const rematchGoOf = (effects: Effect[]): Schedule =>
  effects.find((e): e is Schedule => e.type === 'schedule' && e.timer === 'rematchGo')!;

const fire = (s: Schedule): Action => ({
  type: 'timer',
  timer: s.timer,
  turnId: s.turnId,
  epoch: s.epoch,
});

const nameOf = (room: Room, pid: string) => room.players[pid]!.name;

/** A game with `names` that Ben scored in, ended by the host: FINAL at the returned `at`. */
function toFinal(names = ['Ana', 'Ben', 'Cy']) {
  const { room, pids, at } = dealt(names);
  let r = step(
    room,
    { type: 'drawer:choose', by: asPlayer(room.turn!.drawerPid), index: 0 },
    at,
  ).room;
  r = step(
    r,
    {
      type: 'player:guess',
      by: asPlayer(pids[1]!),
      text: secretWord(r),
      receivedAt: at + 5000,
      oneWayMs: 0,
    },
    at + 5000,
  ).room;
  r = step(r, END, at + 6000).room;
  expect(r.phase).toBe('FINAL');
  return { room: r, pids, at: at + 10_000 };
}

/** Rematch at `t`, then the countdown runs out. */
function rematch(room: Room, t: number) {
  const counting = step(room, REMATCH, t);
  return step(counting.room, fire(rematchGoOf(counting.effects)), t + REMATCH_COUNTDOWN_MS);
}

/** Ends the game in progress at `t` (FINAL). */
const end = (room: Room, t: number) => step(room, END, t).room;

describe('host:rematch', () => {
  it('starts the 3-2-1 and schedules rematchGo; nothing is reset yet', () => {
    const { room, at } = toFinal();
    const res = step(room, REMATCH, at);
    expect(res.room.rematchAt).toBe(at + REMATCH_COUNTDOWN_MS);
    expect(res.room.phase).toBe('FINAL');
    expect(res.effects).toEqual([
      {
        type: 'schedule',
        timer: 'rematchGo',
        at: at + REMATCH_COUNTDOWN_MS,
        turnId: room.turn!.id,
        epoch: room.timerEpoch,
      },
    ]);
    expect(res.room).toEqual({ ...room, rematchAt: at + REMATCH_COUNTDOWN_MS });
  });

  it('is refused while counting down, outside FINAL and from a non-host', () => {
    const { room, pids, at } = toFinal();
    const counting = step(room, REMATCH, at).room;
    expect(reduce(counting, REMATCH, at + 500)).toEqual({ ok: false, error: 'wrongPhase' });
    for (const phase of ['CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD'] as const)
      expect(reduce(inPhase(phase), REMATCH, 3_000_000)).toEqual({
        ok: false,
        error: 'wrongPhase',
      });
    expect(reduce(withPlayers(['Ana', 'Ben']).room, REMATCH, at)).toEqual({
      ok: false,
      error: 'wrongPhase',
    });
    expect(reduce(room, { type: 'host:rematch', by: SCREEN }, at)).toEqual({
      ok: false,
      error: 'notHost',
    });
    // Ben has no crown; Ana (the first joiner) does.
    expect(reduce(room, { type: 'host:rematch', by: asPlayer(pids[1]!, true) }, at)).toEqual({
      ok: false,
      error: 'notHost',
    });
    expect(
      step(room, { type: 'host:rematch', by: asPlayer(pids[0]!, true) }, at).room.rematchAt,
    ).not.toBeNull();
  });
});

describe('timer rematchGo', () => {
  it('starts game 2 in CHOOSING with the next player in join order drawing first', () => {
    const { room, pids, at } = toFinal();
    const ben = room.players[pids[1]!]!.score;
    expect(ben).toBeGreaterThan(0);
    const res = rematch(room, at);
    const r = res.room;
    expect(r.phase).toBe('CHOOSING');
    expect(r.cycle).toBe(1);
    expect(r.turn!.drawerPid).toBe(pids[1]);
    expect(r.turnOrder).toEqual([pids[1], pids[2], pids[0]]);
    expect(r.session.gameNumber).toBe(2);
    expect(r.session.firstDrawerJoinedAt).toBe(r.players[pids[1]!]!.joinedAt);
    expect(r.rematchAt).toBeNull();
    expect(r.history).toEqual([]);
    expect(Object.values(r.players).map((p) => p.score)).toEqual([0, 0, 0]);
    expect(r.session.totals[pids[1]!]).toBe(ben);
    expect(res.effects).toContainEqual({ type: 'inkReset' });
    expect(res.effects).toContainEqual({
      type: 'fx',
      to: { pid: pids[1]! },
      fx: { kind: 'yourTurn' },
    });
    expect(res.effects).toContainEqual(
      expect.objectContaining({ type: 'schedule', timer: 'chooseUp', turnId: r.turn!.id }),
    );
  });

  it('moves the first drawer on by one over three rematches, wrapping round', () => {
    let { room } = toFinal();
    let t = 3_000_000;
    const firsts: string[] = [nameOf(room, room.history[0]!.drawerPid)];
    for (let i = 0; i < 3; i++) {
      room = rematch(room, t).room;
      firsts.push(nameOf(room, room.turn!.drawerPid));
      room = end(room, t + 4000);
      t += 10_000;
    }
    expect(firsts).toEqual(['Ana', 'Ben', 'Cy', 'Ana']);
    expect(room.session.gameNumber).toBe(4);
  });

  it('still moves on when last game’s first drawer has left', () => {
    const { room, pids, at } = toFinal(['Ana', 'Ben', 'Cy', 'Dee']);
    // Game 2: Ben first. He leaves at FINAL; game 3 goes to Cy, who joined after him.
    let r = end(rematch(room, at).room, at + 4000);
    expect(r.history[0]?.drawerPid ?? r.turn!.drawerPid).toBe(pids[1]);
    r = step(r, { type: 'player:leave', by: asPlayer(pids[1]!) }, at + 5000).room;
    r = rematch(r, at + 6000).room;
    expect(r.turn!.drawerPid).toBe(pids[2]);
    // Cy leaves too, and so does Dee: the order wraps to Ana.
    r = end(r, at + 10_000);
    r = step(r, { type: 'player:leave', by: asPlayer(pids[2]!) }, at + 10_001).room;
    r = step(r, { type: 'player:leave', by: asPlayer(pids[3]!) }, at + 10_002).room;
    r = step(
      r,
      { type: 'player:join', by: NEW_PHONE, keyHash: 'key-Eve', name: 'Eve', avatar: '🦊' },
      at + 10_003,
    ).room;
    r = rematch(r, at + 11_000).room;
    // Eve joined after Cy, so she is next; Ana would follow.
    expect(nameOf(r, r.turn!.drawerPid)).toBe('Eve');
    expect(r.turnOrder.map((pid) => nameOf(r, pid))).toEqual(['Eve', 'Ana']);
  });

  it('rotates every cycle of a rematch game like its first', () => {
    const { room, pids, at } = toFinal();
    let r = rematch(room, at).room;
    // Skip the three choices of cycle 1: SCOREBOARD, then cycle 2.
    for (let i = 0; i < 3; i++) r = step(r, SKIP, at + 4000 + i).room;
    expect(r.phase).toBe('SCOREBOARD');
    r = step(r, NEXT, at + 5000).room;
    expect(r.cycle).toBe(2);
    expect(r.turnOrder).toEqual([pids[1], pids[2], pids[0]]);
    expect(r.turn!.drawerPid).toBe(pids[1]);
  });

  it('skips a disconnected player for the first turn, as at a cycle’s start', () => {
    const { room, pids, at } = toFinal();
    const away = step(room, { type: 'sys:disconnected', pid: pids[1]! }, at).room;
    const r = rematch(away, at + 100).room;
    expect(r.turn!.drawerPid).toBe(pids[2]);
    expect(r.session.firstDrawerJoinedAt).toBe(r.players[pids[2]!]!.joinedAt);
  });

  it('puts a player who joined during the countdown in the next game’s order', () => {
    const { room, at } = toFinal();
    const counting = step(room, REMATCH, at);
    const joined = step(
      counting.room,
      { type: 'player:join', by: NEW_PHONE, keyHash: 'key-Dee', name: 'Dee', avatar: '🦊' },
      at + 1000,
    ).room;
    expect(joined.turnOrder).toEqual(room.turnOrder);
    const r = step(joined, fire(rematchGoOf(counting.effects)), at + REMATCH_COUNTDOWN_MS).room;
    expect(r.turnOrder.map((pid) => nameOf(r, pid))).toEqual(['Ben', 'Cy', 'Dee', 'Ana']);
  });

  it('with fewer than 2 connected stays on FINAL with notEnoughPlayers; scores and gallery stay', () => {
    const { room, pids, at } = toFinal();
    const counting = step(room, REMATCH, at);
    let r = step(counting.room, { type: 'sys:disconnected', pid: pids[1]! }, at + 500).room;
    r = step(r, { type: 'sys:disconnected', pid: pids[2]! }, at + 600).room;
    const res = step(r, fire(rematchGoOf(counting.effects)), at + REMATCH_COUNTDOWN_MS);
    expect(res.room.phase).toBe('FINAL');
    expect(res.room.rematchAt).toBeNull();
    expect(res.effects).toEqual([{ type: 'fx', to: 'all', fx: { kind: 'notEnoughPlayers' } }]);
    expect(res.room.history).toEqual(room.history);
    expect(res.room.players[pids[1]!]!.score).toBe(room.players[pids[1]!]!.score);
    expect(res.room.session).toEqual(room.session);
    // The host can try again once someone is back.
    const back = step(res.room, { type: 'sys:connected', pid: pids[1]! }, at + 4000).room;
    expect(rematch(back, at + 5000).room.phase).toBe('CHOOSING');
  });

  it('a 2-player room keeps working: the other player draws first', () => {
    const final = inPhase('FINAL');
    const firstDrawer = final.history[0]!.drawerPid;
    const r = rematch(final, 3_000_000).room;
    expect(r.phase).toBe('CHOOSING');
    expect(r.turn!.drawerPid).not.toBe(firstDrawer);
  });
});

describe('host:rematchCancel', () => {
  it('stops the countdown: FINAL, scores, awards and gallery as they were', () => {
    const { room, at } = toFinal();
    const counting = step(room, REMATCH, at).room;
    const res = step(counting, CANCEL, at + 1000);
    expect(res.effects).toEqual([]);
    expect(res.room.rematchAt).toBeNull();
    expect(res.room.timerEpoch).toBe(room.timerEpoch + 1);
    expect(res.room).toEqual({ ...room, timerEpoch: room.timerEpoch + 1 });
  });

  it('makes the cancelled rematchGo stale; a new rematch works', () => {
    const { room, at } = toFinal();
    const counting = step(room, REMATCH, at);
    const cancelled = step(counting.room, CANCEL, at + 1000).room;
    const go = fire(rematchGoOf(counting.effects));
    expect(reduce(cancelled, go, at + REMATCH_COUNTDOWN_MS)).toEqual({
      ok: false,
      error: 'staleTimer',
    });
    // Even after a second rematch, the first countdown's timer stays stale.
    const again = step(cancelled, REMATCH, at + 2000);
    expect(reduce(again.room, go, at + REMATCH_COUNTDOWN_MS)).toEqual({
      ok: false,
      error: 'staleTimer',
    });
    expect(rematch(cancelled, at + 2000).room.phase).toBe('CHOOSING');
  });

  it('is refused with no countdown running, and from a non-host', () => {
    const { room, at } = toFinal();
    expect(reduce(room, CANCEL, at)).toEqual({ ok: false, error: 'wrongPhase' });
    const counting = step(room, REMATCH, at).room;
    expect(reduce(counting, { type: 'host:rematchCancel', by: SCREEN }, at)).toEqual({
      ok: false,
      error: 'notHost',
    });
  });

  it('host:backToLobby during the countdown cancels it', () => {
    const { room, at } = toFinal();
    const counting = step(room, REMATCH, at);
    const lobby = step(
      counting.room,
      { type: 'host:backToLobby', by: SCREEN_HOST },
      at + 1000,
    ).room;
    expect(lobby.phase).toBe('LOBBY');
    expect(lobby.rematchAt).toBeNull();
    expect(reduce(lobby, fire(rematchGoOf(counting.effects)), at + REMATCH_COUNTDOWN_MS)).toEqual({
      ok: false,
      error: 'staleTimer',
    });
  });
});

describe('join order', () => {
  it('two joins in the same millisecond still get distinct, ordered join times', () => {
    let room = withPlayers(['Ana']).room;
    const t = room.players[Object.keys(room.players)[0]!]!.joinedAt;
    room = step(
      room,
      { type: 'player:join', by: NEW_PHONE, keyHash: 'key-Ben', name: 'Ben', avatar: '🦊' },
      t,
    ).room;
    const [ana, ben] = Object.values(room.players);
    expect(ben!.joinedAt).toBeGreaterThan(ana!.joinedAt);
  });

  it('a later join keeps its own time', () => {
    let room = withPlayers(['Ana']).room;
    room = step(
      room,
      { type: 'player:join', by: NEW_PHONE, keyHash: 'key-Ben', name: 'Ben', avatar: '🦊' },
      2_000_000,
    ).room;
    expect(Object.values(room.players)[1]!.joinedAt).toBe(2_000_000);
  });
});

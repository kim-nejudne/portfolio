// Cycles, SCOREBOARD and FINAL (F20): Phases and Turn order in docs/spec.md.
import { describe, expect, it } from 'vitest';
import { CHOOSE_MS, GRACE_MS, REVEAL_MS, SCOREBOARD_MS } from '../shared/constants.js';
import type { Action, Phase, Room, RoomSettings, TimerName } from '../shared/types.js';
import { reduce } from './reducer.js';
import {
  NEW_PHONE,
  SCREEN,
  SCREEN_HOST,
  T0,
  asPlayer,
  choose,
  makeRoom,
  secretWord,
  step,
  withPlayers,
} from './test/rooms.js';

const timer = (room: Room, name: TimerName): Action => ({
  type: 'timer',
  timer: name,
  turnId: room.turn!.id,
  epoch: room.timerEpoch,
});

const NEXT: Action = { type: 'host:next', by: SCREEN_HOST };

/** Ana, Ben and Cy in CHOOSING, turn 1, with these settings. */
function game(settings: Partial<RoomSettings> = {}, names = ['Ana', 'Ben', 'Cy']) {
  const base = makeRoom();
  const joined = withPlayers(names, { ...base, settings: { ...base.settings, ...settings } });
  const at = T0 + 1000;
  return {
    room: step(joined.room, { type: 'host:start', by: SCREEN_HOST }, at).room,
    pids: joined.pids,
    at,
  };
}

/**
 * Plays the game to FINAL on its timers alone: each drawer takes the first word, the turn ends by
 * time, and every REVEAL and SCOREBOARD runs out. Records each phase entered, and who drew.
 */
function playToFinal(start: Room, at: number) {
  const phases: Phase[] = [start.phase];
  const drawers: string[] = [];
  const cycles: number[] = [];
  let room = start;
  let now = at;
  const go = (action: Action, t: number) => {
    room = step(room, action, t).room;
    now = t;
    phases.push(room.phase);
  };
  for (let guard = 0; room.phase !== 'FINAL' && guard < 100; guard++) {
    switch (room.phase) {
      case 'CHOOSING':
        drawers.push(room.turn!.drawerPid);
        cycles.push(room.turn!.cycle);
        go({ type: 'drawer:choose', by: asPlayer(room.turn!.drawerPid), index: 0 }, now + 1_000);
        break;
      case 'DRAWING':
        go(timer(room, 'drawUp'), room.turn!.endsAt! + GRACE_MS);
        break;
      case 'REVEAL':
        go(timer(room, 'revealDone'), now + REVEAL_MS);
        break;
      case 'SCOREBOARD':
        go(timer(room, 'scoreboardDone'), now + SCOREBOARD_MS);
        break;
      default:
        throw new Error(`stuck in ${room.phase}`);
    }
  }
  return { room, phases, drawers, cycles };
}

/** The current drawing turn ends by time: REVEAL. */
function timeUp(room: Room): Room {
  return step(room, timer(room, 'drawUp'), room.turn!.endsAt! + GRACE_MS).room;
}

/** From CHOOSING, the drawer chooses at once and the turn ends by time: REVEAL. */
function playTurn(room: Room, now: number): Room {
  return timeUp(choose(room, now));
}

describe('3 players × 2 cycles', () => {
  it('visits the phases in order: three turns, SCOREBOARD, three turns, FINAL', () => {
    const { room, at } = game({ cycles: 2 });
    const { phases } = playToFinal(room, at);
    const turn = ['CHOOSING', 'DRAWING', 'REVEAL'];
    expect(phases).toEqual([
      ...turn,
      ...turn,
      ...turn,
      'SCOREBOARD',
      ...turn,
      ...turn,
      ...turn,
      'FINAL',
    ]);
  });

  it('every player draws once a cycle, in join order', () => {
    const { room, pids, at } = game({ cycles: 2 });
    const { drawers, cycles, room: final } = playToFinal(room, at);
    expect(drawers).toEqual([...pids, ...pids]);
    expect(cycles).toEqual([1, 1, 1, 2, 2, 2]);
    expect(final.cycle).toBe(2);
    expect(final.history.map((h) => h.turnId)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('one cycle goes straight to FINAL; three cycles show two scoreboards', () => {
    const one = game({ cycles: 1 });
    const short = playToFinal(one.room, one.at);
    expect(short.phases).not.toContain('SCOREBOARD');
    expect(short.drawers).toHaveLength(3);

    const three = game({ cycles: 3 });
    const long = playToFinal(three.room, three.at);
    expect(long.phases.filter((p) => p === 'SCOREBOARD')).toHaveLength(2);
    expect(long.drawers).toHaveLength(9);
  });

  it('totals keep growing across cycles; SCOREBOARD changes no score', () => {
    const { room, pids, at } = game({ cycles: 2 });
    let r = choose(room, at);
    const word = secretWord(r);
    r = step(
      r,
      { type: 'player:guess', by: asPlayer(pids[1]!), text: word, receivedAt: at, oneWayMs: 0 },
      at,
    ).room;
    r = timeUp(r);
    const after1 = { ...r.players };
    // Turns 2 and 3, nobody guesses.
    for (let i = 0; i < 2; i++) {
      r = step(r, NEXT, at).room;
      r = playTurn(r, at);
    }
    const scoreboard = step(r, NEXT, at).room;
    expect(scoreboard.phase).toBe('SCOREBOARD');
    for (const pid of pids) expect(scoreboard.players[pid]!.score).toBe(after1[pid]!.score);
    expect(scoreboard.players[pids[1]!]!.score).toBeGreaterThan(0);
    const cycle2 = step(scoreboard, NEXT, at).room;
    expect(cycle2.players[pids[1]!]!.score).toBe(after1[pids[1]!]!.score);
  });
});

describe('SCOREBOARD', () => {
  /** Cycle 1 of 2 played out, REVEAL of its last turn. */
  function lastReveal() {
    const { room, pids, at } = game({ cycles: 2 });
    let r = playTurn(room, at);
    r = playTurn(step(r, NEXT, at).room, at);
    r = playTurn(step(r, NEXT, at).room, at);
    return { room: r, pids, at };
  }

  it('follows the last REVEAL of a cycle with cycles left, and schedules scoreboardDone in 6 s', () => {
    const { room } = lastReveal();
    const now = T0 + 500_000;
    const { room: after, effects } = step(room, timer(room, 'revealDone'), now);
    expect(after.phase).toBe('SCOREBOARD');
    expect(after.timerEpoch).toBe(room.timerEpoch + 1);
    // The next cycle's first deal (F21) keeps its chooseUp across the phase change.
    expect(effects).toEqual([
      {
        type: 'schedule',
        timer: 'chooseUp',
        at: room.upcoming!.dealtAt + CHOOSE_MS,
        turnId: room.upcoming!.id,
        epoch: after.timerEpoch,
      },
      {
        type: 'schedule',
        timer: 'scoreboardDone',
        at: now + SCOREBOARD_MS,
        turnId: after.turn!.id,
        epoch: after.timerEpoch,
      },
    ]);
  });

  it('scoreboardDone starts the next cycle in join order with the drawer dealt at the reveal', () => {
    const { room, pids } = lastReveal();
    // The last REVEAL of cycle 1 dealt cycle 2's first drawer (F21).
    expect(room.upcoming).toMatchObject({ id: 4, cycle: 2, drawerPid: pids[0] });
    const board = step(room, NEXT, T0 + 500_000).room;
    const now = T0 + 506_000;
    const { room: after } = step(board, timer(board, 'scoreboardDone'), now);
    expect(after.phase).toBe('CHOOSING');
    expect(after.cycle).toBe(2);
    expect(after.turnOrder).toEqual(pids);
    expect(after.turnIndex).toBe(0);
    expect(after.turn).toMatchObject({
      id: 4,
      cycle: 2,
      drawerPid: pids[0],
      dealtAt: room.upcoming!.dealtAt,
    });
  });

  it('host:next leaves SCOREBOARD at once, and the old scoreboardDone is stale', () => {
    const { room } = lastReveal();
    const board = step(room, NEXT, T0 + 500_000).room;
    const pending = timer(board, 'scoreboardDone');
    const after = step(board, NEXT, T0 + 501_000).room;
    expect(after.phase).toBe('CHOOSING');
    expect(after.cycle).toBe(2);
    expect(reduce(after, pending, T0 + 506_000)).toEqual({ ok: false, error: 'staleTimer' });
  });

  it('a stale revealDone after host:next does not skip the scoreboard', () => {
    const { room } = lastReveal();
    const pending = timer(room, 'revealDone');
    const board = step(room, NEXT, T0 + 500_000).room;
    expect(reduce(board, pending, T0 + 508_000)).toEqual({ ok: false, error: 'staleTimer' });
  });

  it('host:next needs the host', () => {
    const { room, pids } = lastReveal();
    const board = step(room, NEXT, T0 + 500_000).room;
    for (const by of [SCREEN, asPlayer(pids[1]!)])
      expect(reduce(board, { type: 'host:next', by }, T0 + 501_000)).toEqual({
        ok: false,
        error: 'notHost',
      });
    // Ana holds the crown.
    const crowned = step(board, { type: 'host:next', by: asPlayer(pids[0]!, true) }, T0 + 501_000);
    expect(crowned.room.phase).toBe('CHOOSING');
  });

  it('host:next is refused in LOBBY, CHOOSING, DRAWING and FINAL', () => {
    const { room: lobby } = withPlayers(['Ana', 'Ben']);
    const { room: choosing, at } = game({ cycles: 1 });
    const drawing = choose(choosing, at);
    const final = playToFinal(choosing, at).room;
    for (const r of [lobby, choosing, drawing, final])
      expect(reduce(r, NEXT, at)).toEqual({ ok: false, error: 'wrongPhase' });
  });

  it('a pause holds REVEAL and SCOREBOARD: revealDone and scoreboardDone are refused', () => {
    const { room } = lastReveal();
    const paused = { reasons: ['host' as const], since: T0, remainingMs: null, resumeAt: null };
    expect(reduce({ ...room, paused }, timer(room, 'revealDone'), T0 + 500_000)).toEqual({
      ok: false,
      error: 'paused',
    });
    const board = step(room, NEXT, T0 + 500_000).room;
    expect(reduce({ ...board, paused }, timer(board, 'scoreboardDone'), T0 + 506_000)).toEqual({
      ok: false,
      error: 'paused',
    });
  });

  it('scoreboardDone is refused outside SCOREBOARD', () => {
    const { room } = lastReveal();
    const early: Action = { ...timer(room, 'scoreboardDone') };
    expect(reduce(room, early, T0 + 500_000)).toEqual({ ok: false, error: 'wrongPhase' });
  });
});

describe('without auto-advance', () => {
  it('schedules neither revealDone nor scoreboardDone; host:next moves REVEAL and SCOREBOARD on', () => {
    const { room, at } = game({ cycles: 2, autoAdvance: false });
    let r = room;
    const scheduled: TimerName[] = [];
    const phases: Phase[] = [];
    const track = (action: Action, now: number) => {
      const res = step(r, action, now);
      r = res.room;
      phases.push(r.phase);
      for (const e of res.effects) if (e.type === 'schedule') scheduled.push(e.timer);
    };
    for (let i = 0; i < 3; i++) {
      track({ type: 'drawer:choose', by: asPlayer(r.turn!.drawerPid), index: 0 }, at);
      track(timer(r, 'drawUp'), r.turn!.endsAt! + GRACE_MS);
      track(NEXT, at);
    }
    expect(phases.slice(-1)).toEqual(['SCOREBOARD']);
    expect(scheduled).not.toContain('revealDone');
    expect(scheduled).not.toContain('scoreboardDone');
    track(NEXT, at);
    expect(r.phase).toBe('CHOOSING');
    expect(r.cycle).toBe(2);
  });
});

describe('turn order across cycles', () => {
  it('a player disconnected when their turn comes is skipped, and draws again next cycle', () => {
    const { room, pids, at } = game({ cycles: 2 });
    let r = step(room, { type: 'sys:disconnected', pid: pids[1]! }, at).room;
    r = playTurn(r, at);
    r = step(r, NEXT, at).room;
    expect(r.turn!.drawerPid).toBe(pids[2]);
    r = step(r, { type: 'sys:connected', pid: pids[1]! }, at).room;
    r = playTurn(r, at);
    r = step(r, NEXT, at).room;
    expect(r.phase).toBe('SCOREBOARD');
    r = step(r, NEXT, at).room;
    const { drawers } = playToFinal(r, at);
    expect(drawers).toEqual(pids);
  });

  it('a mid-game joiner with turns left draws this cycle and the next, in join order', () => {
    const { room, pids, at } = game({ cycles: 2 });
    const r = step(
      room,
      { type: 'player:join', by: NEW_PHONE, keyHash: 'key-Dee', name: 'Dee', avatar: '🦊' },
      at,
    ).room;
    const dee = Object.values(r.players).find((p) => p.name === 'Dee')!.pid;
    const { drawers } = playToFinal(r, at);
    // F23: turns remained, so Dee is appended to cycle 1; cycle 2 is built in join order.
    expect(drawers).toEqual([...pids, dee, ...pids, dee]);
  });

  it('a player who leaves during SCOREBOARD is not in the next cycle', () => {
    const { room, pids, at } = game({ cycles: 2 });
    let r = room;
    for (let i = 0; i < 3; i++) r = step(playTurn(r, at), NEXT, at).room;
    expect(r.phase).toBe('SCOREBOARD');
    r = step(r, { type: 'player:leave', by: asPlayer(pids[1]!) }, at).room;
    r = step(r, NEXT, at).room;
    expect(r.turnOrder).toEqual([pids[0], pids[2]]);
    expect(playToFinal(r, at).drawers).toEqual([pids[0], pids[2]]);
  });

  it('a skipped last CHOOSING of a cycle goes to SCOREBOARD, and of the last cycle to FINAL', () => {
    const { room, at } = game({ cycles: 2 });
    let r = room;
    for (let i = 0; i < 2; i++) r = step(playTurn(r, at), NEXT, at).room;
    const skip: Action = { type: 'host:skip', by: SCREEN_HOST };
    const board = step(r, skip, at);
    expect(board.room.phase).toBe('SCOREBOARD');
    expect(board.effects.some((e) => e.type === 'schedule' && e.timer === 'scoreboardDone')).toBe(
      true,
    );
    r = step(board.room, NEXT, at).room;
    for (let i = 0; i < 2; i++) r = step(playTurn(r, at), NEXT, at).room;
    expect(step(r, skip, at).room.phase).toBe('FINAL');
  });

  // F41: nobody connected can no longer reach a new cycle; `fewPlayers` holds the SCOREBOARD
  // (`startCycle`'s FINAL with nobody to draw stays as a backstop, DECISIONS 63).
  it('everyone gone at the SCOREBOARD: too few players holds it there, and Next is refused', () => {
    const { room, pids, at } = game({ cycles: 2 });
    let r = room;
    for (let i = 0; i < 3; i++) r = step(playTurn(r, at), NEXT, at).room;
    expect(r.phase).toBe('SCOREBOARD');
    for (const pid of pids) r = step(r, { type: 'sys:disconnected', pid }, at).room;
    expect(r.paused?.reasons).toEqual(['fewPlayers']);
    expect(reduce(r, NEXT, at)).toEqual({ ok: false, error: 'paused' });
  });

  it('FINAL keeps the scores and history of the whole game', () => {
    const { room, at } = game({ cycles: 2 });
    const { room: final } = playToFinal(room, at);
    expect(final.history).toHaveLength(6);
    expect(final.upcoming).toBeNull();
    expect(final.turnIndex).toBe(final.turnOrder.length);
  });
});

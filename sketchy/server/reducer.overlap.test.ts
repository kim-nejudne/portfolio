// Overlapped choosing (F21): the next drawer is dealt on entering REVEAL and chooses during REVEAL
// and SCOREBOARD. Phases, Transitions (Deal, Take up) and Scheduled effects in docs/spec.md.
import { describe, expect, it } from 'vitest';
import { CHOOSE_MS, GRACE_MS, REVEAL_MS, SCOREBOARD_MS } from '../shared/constants.js';
import type { Action, Effect, Room, RoomSettings, TimerName } from '../shared/types.js';
import { reduce } from './reducer.js';
import { toView } from './views.js';
import { SCREEN, SCREEN_HOST, T0, asPlayer, makeRoom, step, withPlayers } from './test/rooms.js';

/** A timer for the current turn at the current epoch. */
const timer = (room: Room, name: TimerName): Action => ({
  type: 'timer',
  timer: name,
  turnId: room.turn!.id,
  epoch: room.timerEpoch,
});

/** The upcoming deal's `chooseUp` at the current epoch. */
const upChooseUp = (room: Room): Action => ({
  type: 'timer',
  timer: 'chooseUp',
  turnId: room.upcoming!.id,
  epoch: room.timerEpoch,
});

const pick = (pid: string, index: 0 | 1 | 2 = 0): Action => ({
  type: 'drawer:choose',
  by: asPlayer(pid),
  index,
});

const NEXT: Action = { type: 'host:next', by: SCREEN_HOST };

const schedules = (effects: Effect[], name: TimerName) =>
  effects.filter(
    (e): e is Extract<Effect, { type: 'schedule' }> => e.type === 'schedule' && e.timer === name,
  );

/**
 * Ana, Ben and Cy (2 cycles by default): Ana's turn 1 is chosen at `T0 + 1000` and runs out of
 * time, so the room is in REVEAL at `at`, with Ben dealt as `upcoming`.
 */
function revealOfTurn1(settings: Partial<RoomSettings> = {}, names = ['Ana', 'Ben', 'Cy']) {
  const base = makeRoom();
  const joined = withPlayers(names, { ...base, settings: { ...base.settings, ...settings } });
  let room = step(joined.room, { type: 'host:start', by: SCREEN_HOST }, T0 + 1000).room;
  room = step(room, pick(joined.pids[0]!), T0 + 1000).room;
  const at = room.turn!.endsAt! + GRACE_MS;
  const res = step(room, timer(room, 'drawUp'), at);
  return { room: res.room, effects: res.effects, pids: joined.pids, at };
}

/** Plays the current DRAWING turn out by time: REVEAL. */
function timeUp(room: Room) {
  const at = room.turn!.endsAt! + GRACE_MS;
  return { ...step(room, timer(room, 'drawUp'), at), at };
}

describe('the deal on entering REVEAL', () => {
  it('deals the next drawer as upcoming, tells them, and keeps the revealed turn', () => {
    const { room, effects, pids, at } = revealOfTurn1();
    expect(room.phase).toBe('REVEAL');
    expect(room.turn!.drawerPid).toBe(pids[0]);
    expect(room.turn!.endReason).toBe('time');
    const up = room.upcoming!;
    expect(up.drawerPid).toBe(pids[1]);
    expect(up.id).toBe(room.turn!.id + 1);
    expect(up.cycle).toBe(1);
    expect(up.dealtAt).toBe(at);
    expect(up.word).toBeNull();
    expect(up.choices.map((c) => c.difficulty)).toEqual([1, 2, 3]);
    expect(effects).toContainEqual({
      type: 'fx',
      to: { pid: pids[1] },
      fx: { kind: 'yourTurn' },
    });
  });

  it('schedules chooseUp 12 s after the deal for the upcoming turn, and revealDone in 8 s', () => {
    const { room, effects, at } = revealOfTurn1();
    expect(schedules(effects, 'chooseUp')).toEqual([
      {
        type: 'schedule',
        timer: 'chooseUp',
        at: at + CHOOSE_MS,
        turnId: room.upcoming!.id,
        epoch: room.timerEpoch,
      },
    ]);
    expect(schedules(effects, 'revealDone')).toEqual([
      {
        type: 'schedule',
        timer: 'revealDone',
        at: at + REVEAL_MS,
        turnId: room.turn!.id,
        epoch: room.timerEpoch,
      },
    ]);
  });

  it('skips a disconnected player and deals the following one', () => {
    // Ben drops during turn 1's drawing, before the deal.
    const { room: lobby, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    let room = step(lobby, { type: 'host:start', by: SCREEN_HOST }, T0 + 1000).room;
    room = step(room, pick(pids[0]!), T0 + 1000).room;
    room = step(room, { type: 'sys:disconnected', pid: pids[1]! }, T0 + 2000).room;
    room = timeUp(room).room;
    expect(room.upcoming!.drawerPid).toBe(pids[2]);
  });

  it('deals the next cycle’s first drawer at the end of a cycle, in that cycle’s order', () => {
    const first = revealOfTurn1();
    const { pids } = first;
    let room = first.room;
    room = step(room, pick(pids[1]!), room.upcoming!.dealtAt + 1000).room; // Ben chooses
    room = step(room, NEXT, room.upcoming!.dealtAt + 2000).room; // Ben draws
    room = timeUp(room).room;
    room = step(room, NEXT, room.upcoming!.dealtAt + 1000).room; // Cy, not chosen: CHOOSING
    room = step(room, pick(pids[2]!), room.turn!.dealtAt + 2000).room;
    room = timeUp(room).room;
    expect(room.cycle).toBe(1);
    expect(room.upcoming!.drawerPid).toBe(pids[0]);
    expect(room.upcoming!.cycle).toBe(2);
    expect(room.turnOrder).toEqual(pids);
  });

  it('deals nothing after the last turn of the game', () => {
    const { room } = revealOfTurn1({ cycles: 1 }, ['Ana', 'Ben']);
    let r = step(room, NEXT, room.upcoming!.dealtAt + 1000).room; // Ben: CHOOSING
    r = step(r, pick(r.turn!.drawerPid), r.turn!.dealtAt + 2000).room;
    const end = timeUp(r);
    expect(end.room.phase).toBe('REVEAL');
    expect(end.room.upcoming).toBeNull();
    expect(schedules(end.effects, 'chooseUp')).toEqual([]);
    expect(end.effects.some((e) => e.type === 'fx' && e.fx.kind === 'yourTurn')).toBe(false);
    expect(step(end.room, NEXT, end.at + 1000).room.phase).toBe('FINAL');
  });
});

describe('choosing during REVEAL', () => {
  it('sets upcoming.word and nothing else; then DRAWING at once when REVEAL ends', () => {
    const { room, pids, at } = revealOfTurn1();
    const chose = step(room, pick(pids[1]!, 2), at + 3000);
    expect(chose.room.phase).toBe('REVEAL');
    expect(chose.room.upcoming!.word).toEqual(room.upcoming!.choices[2]);
    expect(chose.room.turn).toEqual(room.turn);
    expect(chose.room.timerEpoch).toBe(room.timerEpoch);
    expect(chose.effects).toEqual([]);
    expect(chose.room.deck.usedIds).toContain(room.upcoming!.choices[2].id);

    const done = at + REVEAL_MS;
    const res = step(chose.room, timer(chose.room, 'revealDone'), done);
    expect(res.room.phase).toBe('DRAWING');
    expect(res.room.upcoming).toBeNull();
    expect(res.room.turn!.id).toBe(room.upcoming!.id);
    expect(res.room.turn!.drawerPid).toBe(pids[1]);
    expect(res.room.turn!.word!.word).toBe(room.upcoming!.choices[2].word);
    // The clock starts when REVEAL ends, not at the choice.
    expect(res.room.turn!.clockStart).toBe(done);
    expect(res.room.turn!.endsAt).toBe(done + 60_000);
    expect(res.effects).toContainEqual({
      type: 'inkOpen',
      turnId: room.upcoming!.id,
      drawerPid: pids[1],
    });
    expect(schedules(res.effects, 'drawUp')[0]!.at).toBe(done + 60_000 + GRACE_MS);
    expect(schedules(res.effects, 'chooseUp')).toEqual([]);
  });

  it('host:next in REVEAL also takes up a chosen word straight into DRAWING', () => {
    const { room, pids, at } = revealOfTurn1({ autoAdvance: false });
    const chose = step(room, pick(pids[1]!), at + 1000).room;
    expect(step(chose, NEXT, at + 20_000).room.phase).toBe('DRAWING');
  });

  it('is refused from anyone but the upcoming drawer, and once chosen', () => {
    const { room, pids, at } = revealOfTurn1();
    const refused = (by: Action, error: string) =>
      expect(reduce(room, by, at + 1000)).toEqual({ ok: false, error });
    refused(pick(pids[0]!), 'notDrawer'); // the drawer just revealed
    refused(pick(pids[2]!), 'notDrawer');
    refused({ type: 'drawer:choose', by: SCREEN, index: 0 }, 'notPlayer');
    const chose = step(room, pick(pids[1]!), at + 1000).room;
    expect(reduce(chose, pick(pids[1]!, 1), at + 2000)).toEqual({
      ok: false,
      error: 'wrongPhase',
    });
  });

  it('is refused in REVEAL when nothing was dealt', () => {
    const { room, pids, at } = revealOfTurn1();
    const none: Room = { ...room, upcoming: null };
    expect(reduce(none, pick(pids[1]!), at + 1000)).toEqual({ ok: false, error: 'wrongPhase' });
  });
});

describe('no choice by the end of REVEAL', () => {
  it('goes to CHOOSING until 12 s after the deal, then auto-picks the easiest', () => {
    const { room, pids, at } = revealOfTurn1();
    const res = step(room, timer(room, 'revealDone'), at + REVEAL_MS);
    expect(res.room.phase).toBe('CHOOSING');
    expect(res.room.turn!.id).toBe(room.upcoming!.id);
    expect(res.room.turn!.drawerPid).toBe(pids[1]);
    expect(res.room.upcoming).toBeNull();
    expect(schedules(res.effects, 'chooseUp')).toEqual([
      {
        type: 'schedule',
        timer: 'chooseUp',
        at: at + CHOOSE_MS,
        turnId: room.upcoming!.id,
        epoch: res.room.timerEpoch,
      },
    ]);
    // Everyone sees the 4 s still left on the choice.
    const screen = toView(res.room, { kind: 'screen', isHost: false }, at + REVEAL_MS);
    expect(screen.turn!.timer!.remainingMs).toBe(CHOOSE_MS - REVEAL_MS);

    // REVEAL's chooseUp is stale now (an older epoch); the re-scheduled one picks.
    expect(reduce(res.room, upChooseUp(room), at + CHOOSE_MS)).toEqual({
      ok: false,
      error: 'staleTimer',
    });
    const picked = step(res.room, timer(res.room, 'chooseUp'), at + CHOOSE_MS).room;
    expect(picked.phase).toBe('DRAWING');
    expect(picked.turn!.word!.difficulty).toBe(1);
  });

  it('the drawer can still choose in CHOOSING', () => {
    const { room, pids, at } = revealOfTurn1();
    const choosing = step(room, timer(room, 'revealDone'), at + REVEAL_MS).room;
    const res = step(choosing, pick(pids[1]!, 1), at + REVEAL_MS + 1000).room;
    expect(res.phase).toBe('DRAWING');
    expect(res.turn!.word!.difficulty).toBe(2);
  });
});

describe('the auto-pick for upcoming', () => {
  it('during REVEAL (no auto-advance) sets the easiest word and stays in REVEAL', () => {
    const { room, at } = revealOfTurn1({ autoAdvance: false });
    const res = step(room, upChooseUp(room), at + CHOOSE_MS);
    expect(res.room.phase).toBe('REVEAL');
    expect(res.room.upcoming!.word!.difficulty).toBe(1);
    expect(res.effects).toEqual([]);
    expect(step(res.room, NEXT, at + 20_000).room.phase).toBe('DRAWING');
  });

  it('is ignored once the upcoming drawer has chosen', () => {
    const { room, pids, at } = revealOfTurn1();
    const chose = step(room, pick(pids[1]!, 2), at + 1000).room;
    expect(reduce(chose, upChooseUp(chose), at + CHOOSE_MS)).toEqual({
      ok: false,
      error: 'staleTimer',
    });
  });

  it('during SCOREBOARD: chooseUp follows the choice across the phase change', () => {
    // Two players, so turn 2 ends cycle 1 and Ana is dealt cycle 2's first turn.
    const first = revealOfTurn1({}, ['Ana', 'Ben']);
    const { pids } = first;
    let room = first.room;
    room = step(room, pick(pids[1]!), room.upcoming!.dealtAt + 1000).room;
    room = step(room, NEXT, room.upcoming!.dealtAt + 2000).room;
    const reveal = timeUp(room);
    const up = reveal.room.upcoming!;
    expect(up.drawerPid).toBe(pids[0]);
    expect(up.cycle).toBe(2);

    const board = step(reveal.room, timer(reveal.room, 'revealDone'), reveal.at + REVEAL_MS);
    expect(board.room.phase).toBe('SCOREBOARD');
    expect(board.room.cycle).toBe(1);
    expect(board.room.upcoming!.id).toBe(up.id);
    expect(schedules(board.effects, 'chooseUp')).toEqual([
      {
        type: 'schedule',
        timer: 'chooseUp',
        at: up.dealtAt + CHOOSE_MS,
        turnId: up.id,
        epoch: board.room.timerEpoch,
      },
    ]);
    // REVEAL's schedule went stale with the phase change.
    expect(reduce(board.room, upChooseUp(reveal.room), up.dealtAt + CHOOSE_MS)).toEqual({
      ok: false,
      error: 'staleTimer',
    });

    const picked = step(board.room, upChooseUp(board.room), up.dealtAt + CHOOSE_MS).room;
    expect(picked.phase).toBe('SCOREBOARD');
    expect(picked.upcoming!.word!.difficulty).toBe(1);

    const go = up.dealtAt + REVEAL_MS + SCOREBOARD_MS;
    const res = step(picked, timer(picked, 'scoreboardDone'), go).room;
    expect(res.phase).toBe('DRAWING');
    expect(res.cycle).toBe(2);
    expect(res.turn!.drawerPid).toBe(pids[0]);
    expect(res.turn!.cycle).toBe(2);
    expect(res.turn!.clockStart).toBe(go);
  });

  it('a choice made during SCOREBOARD is taken up by host:next', () => {
    const first = revealOfTurn1({ autoAdvance: false }, ['Ana', 'Ben']);
    const { pids } = first;
    let room = first.room;
    room = step(room, pick(pids[1]!), room.upcoming!.dealtAt + 1000).room;
    room = step(room, NEXT, room.upcoming!.dealtAt + 2000).room;
    const reveal = timeUp(room);
    const board = step(reveal.room, NEXT, reveal.at + 1000).room;
    expect(board.phase).toBe('SCOREBOARD');
    const chose = step(board, pick(pids[0]!, 1), reveal.at + 2000);
    expect(chose.room.phase).toBe('SCOREBOARD');
    expect(chose.effects).toEqual([]);
    const res = step(chose.room, NEXT, reveal.at + 3000).room;
    expect(res.phase).toBe('DRAWING');
    expect(res.turn!.word!.difficulty).toBe(2);
  });
});

describe('the upcoming drawer gone at take-up', () => {
  it('left: the deal is discarded, its words go back, and the following player chooses', () => {
    const { room, pids, at } = revealOfTurn1();
    const up = room.upcoming!;
    const left = step(room, { type: 'player:leave', by: asPlayer(pids[1]!) }, at + 1000).room;
    const done = at + REVEAL_MS;
    const res = step(left, timer(left, 'revealDone'), done);
    expect(res.room.phase).toBe('CHOOSING');
    expect(res.room.upcoming).toBeNull();
    expect(res.room.turn!.drawerPid).toBe(pids[2]);
    expect(res.room.turn!.dealtAt).toBe(done);
    expect(res.room.turn!.id).toBe(up.id + 1);
    expect(res.room.history).toHaveLength(1);
    expect(res.effects).toContainEqual({
      type: 'fx',
      to: { pid: pids[2] },
      fx: { kind: 'yourTurn' },
    });
    expect(schedules(res.effects, 'chooseUp')[0]!.at).toBe(done + CHOOSE_MS);
    // Ben's three words went back to the deck before Cy's deal.
    for (const c of up.choices) expect(res.room.deck.usedIds).not.toContain(c.id);
  });

  it('left after choosing: the chosen word is not used up', () => {
    const { room, pids, at } = revealOfTurn1();
    const word = room.upcoming!.choices[1];
    let r = step(room, pick(pids[1]!, 1), at + 1000).room;
    expect(r.deck.usedIds).toContain(word.id);
    r = step(r, { type: 'player:leave', by: asPlayer(pids[1]!) }, at + 2000).room;
    r = step(r, timer(r, 'revealDone'), at + REVEAL_MS).room;
    expect(r.turn!.drawerPid).toBe(pids[2]);
    expect(r.deck.usedIds).not.toContain(word.id);
  });

  it('disconnected: discarded too, and they draw again next cycle', () => {
    const { room, pids, at } = revealOfTurn1();
    let r = step(room, pick(pids[1]!), at + 1000).room;
    r = step(r, { type: 'sys:disconnected', pid: pids[1]! }, at + 2000).room;
    r = step(r, timer(r, 'revealDone'), at + REVEAL_MS).room;
    expect(r.phase).toBe('CHOOSING');
    expect(r.turn!.drawerPid).toBe(pids[2]);
    // Ben is back for cycle 2, which starts in join order.
    r = step(r, { type: 'sys:connected', pid: pids[1]! }, at + REVEAL_MS + 1000).room;
    r = step(r, pick(pids[2]!), at + REVEAL_MS + 2000).room;
    const reveal = timeUp(r);
    expect(reveal.room.upcoming!.cycle).toBe(2);
    expect(reveal.room.upcoming!.drawerPid).toBe(pids[0]);
    expect(reveal.room.turnOrder).toEqual(pids);
  });

  it('reconnected before take-up: the deal stands', () => {
    const { room, pids, at } = revealOfTurn1();
    let r = step(room, pick(pids[1]!), at + 1000).room;
    r = step(r, { type: 'sys:disconnected', pid: pids[1]! }, at + 2000).room;
    r = step(r, { type: 'sys:connected', pid: pids[1]! }, at + 3000).room;
    r = step(r, timer(r, 'revealDone'), at + REVEAL_MS).room;
    expect(r.phase).toBe('DRAWING');
    expect(r.turn!.drawerPid).toBe(pids[1]);
  });

  it('with nobody following in the cycle, the cycle ends instead', () => {
    // One cycle: Cy leaves, then Ben, dealt turn 2, leaves too; nobody is left to draw.
    const { room, pids, at } = revealOfTurn1({ cycles: 1 }, ['Ana', 'Ben', 'Cy']);
    let r = step(room, { type: 'player:leave', by: asPlayer(pids[2]!) }, at + 500).room;
    r = step(r, { type: 'player:leave', by: asPlayer(pids[1]!) }, at + 1000).room;
    r = step(r, timer(r, 'revealDone'), at + REVEAL_MS).room;
    expect(r.phase).toBe('FINAL');
    expect(r.upcoming).toBeNull();
  });
});

describe('a discarded first deal of a new cycle', () => {
  /** Ana and Ben, 3 cycles: cycle 1's last REVEAL deals Ana cycle 2's first turn; then SCOREBOARD. */
  function boardWithAnaUp() {
    const first = revealOfTurn1({ cycles: 3 }, ['Ana', 'Ben']);
    const { pids } = first;
    let room = step(first.room, pick(pids[1]!), first.at + 1000).room;
    room = step(room, NEXT, first.at + 2000).room;
    const reveal = timeUp(room);
    room = step(reveal.room, NEXT, reveal.at + 1000).room;
    expect(room.phase).toBe('SCOREBOARD');
    expect(room.upcoming).toMatchObject({ drawerPid: pids[0], cycle: 2 });
    return { room, pids, at: reveal.at + 1000 };
  }

  it('starts that cycle with the next connected player', () => {
    const { room, pids, at } = boardWithAnaUp();
    let r = step(room, { type: 'sys:disconnected', pid: pids[0]! }, at + 500).room;
    r = step(r, NEXT, at + 1000).room;
    expect(r.phase).toBe('CHOOSING');
    expect(r.cycle).toBe(2);
    expect(r.turn!.drawerPid).toBe(pids[1]);
  });

  it('with nobody connected to draw, ends the game rather than showing another SCOREBOARD', () => {
    const { room, pids, at } = boardWithAnaUp();
    let r = step(room, { type: 'sys:disconnected', pid: pids[0]! }, at + 500).room;
    r = step(r, { type: 'sys:disconnected', pid: pids[1]! }, at + 600).room;
    r = step(r, NEXT, at + 1000).room;
    expect(r.phase).toBe('FINAL');
    expect(r.upcoming).toBeNull();
  });
});

describe('the upcoming drawer’s view', () => {
  it('counts down to the auto-pick during REVEAL; nobody else gets a secret', () => {
    const { room, pids, at } = revealOfTurn1();
    const view = (pid: string, now: number) => {
      const v = toView(room, { kind: 'player', pid }, now);
      if (v.role !== 'player') throw new Error('not a player view');
      return v;
    };
    expect(view(pids[1]!, at + 3000).secret!.chooseTimer).toEqual({
      remainingMs: CHOOSE_MS - 3000,
      totalMs: CHOOSE_MS,
      running: true,
    });
    expect(view(pids[0]!, at + 3000).secret).toBeNull();
    expect(view(pids[2]!, at + 3000).secret).toBeNull();
    // Chosen: no countdown.
    const chose = step(room, pick(pids[1]!), at + 4000).room;
    const after = toView(chose, { kind: 'player', pid: pids[1]! }, at + 5000);
    expect(after.role === 'player' && after.secret!.chooseTimer).toBeNull();
  });

  it('freezes the countdown while paused', () => {
    const { room, pids, at } = revealOfTurn1();
    const paused: Room = {
      ...room,
      paused: { reasons: ['host'], since: at + 2000, remainingMs: null, resumeAt: null },
    };
    const v = toView(paused, { kind: 'player', pid: pids[1]! }, at + 9000);
    expect(v.role === 'player' && v.secret!.chooseTimer).toEqual({
      remainingMs: CHOOSE_MS - 2000,
      totalMs: CHOOSE_MS,
      running: false,
    });
  });
});

describe('a pause holds the upcoming choice open', () => {
  it('refuses the choice and the auto-pick while paused, and keeps the deal', () => {
    const { room, pids, at } = revealOfTurn1();
    const paused: Room = {
      ...room,
      paused: { reasons: ['host'], since: at + 1000, remainingMs: null, resumeAt: null },
    };
    expect(reduce(paused, pick(pids[1]!), at + 2000)).toEqual({ ok: false, error: 'paused' });
    expect(reduce(paused, upChooseUp(paused), at + CHOOSE_MS)).toEqual({
      ok: false,
      error: 'paused',
    });
    // Unpaused, the same deal is still open to the same drawer.
    const resumed: Room = { ...paused, paused: null };
    const chose = step(resumed, pick(pids[1]!, 2), at + 20_000).room;
    expect(chose.upcoming!.word).toEqual(room.upcoming!.choices[2]);
  });
});

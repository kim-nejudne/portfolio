// Late joiners and the turn order (F23): Turn order (Late joiners) and Edge cases ("Someone joins
// mid-game", disconnects) in docs/spec.md.
import { describe, expect, it } from 'vitest';
import { GRACE_MS, REVEAL_MS, SCOREBOARD_MS } from '../shared/constants.js';
import type { Action, Room, RoomSettings, TimerName } from '../shared/types.js';
import { reduce } from './reducer.js';
import { guesserPoints } from './scoring.js';
import { toView } from './views.js';
import {
  NEW_PHONE,
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
function game(settings: Partial<RoomSettings> = {}) {
  const base = makeRoom();
  const joined = withPlayers(['Ana', 'Ben', 'Cy'], {
    ...base,
    settings: { ...base.settings, ...settings },
  });
  const at = T0 + 1000;
  return {
    room: step(joined.room, { type: 'host:start', by: SCREEN_HOST }, at).room,
    pids: joined.pids,
    at,
  };
}

/** Dee (or `name`) joins from a new phone; returns the room and their pid. */
function join(room: Room, at: number, name = 'Dee') {
  const r = step(
    room,
    { type: 'player:join', by: NEW_PHONE, keyHash: `key-${name}`, name, avatar: '🦊' },
    at,
  ).room;
  return { room: r, pid: Object.values(r.players).find((p) => p.name === name)!.pid };
}

/** The current drawing turn ends by time: REVEAL. */
function timeUp(room: Room): Room {
  return step(room, timer(room, 'drawUp'), room.turn!.endsAt! + GRACE_MS).room;
}

/** From CHOOSING, the drawer chooses at once and the turn ends by time: REVEAL. */
function playTurn(room: Room, now: number): Room {
  return timeUp(choose(room, now));
}

/**
 * Plays on its timers alone to FINAL: each drawer takes the first word (in CHOOSING, or during the
 * reveal when dealt as `upcoming`), each turn ends by time. Returns who drew, in order.
 */
function playToFinal(start: Room, at: number): { room: Room; drawers: string[] } {
  const drawers: string[] = [];
  let room = start;
  let now = at;
  for (let guard = 0; room.phase !== 'FINAL' && guard < 100; guard++) {
    switch (room.phase) {
      case 'CHOOSING':
        room = choose(room, (now += 1_000));
        break;
      case 'DRAWING':
        drawers.push(room.turn!.drawerPid);
        now = room.turn!.endsAt! + GRACE_MS;
        room = timeUp(room);
        break;
      case 'REVEAL':
        room = step(room, timer(room, 'revealDone'), (now += REVEAL_MS)).room;
        break;
      case 'SCOREBOARD':
        room = step(room, timer(room, 'scoreboardDone'), (now += SCOREBOARD_MS)).room;
        break;
      default:
        throw new Error(`stuck in ${room.phase}`);
    }
  }
  return { room, drawers };
}

describe('a mid-game joiner guesses at once', () => {
  it('scores in the current turn, timed from the turn start, so they earn less', () => {
    const { room, at } = game({ cycles: 1 });
    const drawing = choose(room, at);
    const joinedAt = at + 20_000;
    const { room: r, pid: dee } = join(drawing, joinedAt);
    const res = reduce(
      r,
      {
        type: 'player:guess',
        by: asPlayer(dee),
        text: secretWord(r),
        receivedAt: joinedAt + 1_000,
        oneWayMs: 0,
      },
      joinedAt + 1_000,
    );
    if (!res.ok) throw new Error(res.error);
    const points = guesserPoints(r.settings.drawSeconds * 1000, 21_000);
    expect(res.room.players[dee]!.score).toBe(points);
    expect(points).toBeLessThan(guesserPoints(r.settings.drawSeconds * 1000, 0));
  });

  it('gets the turn in their view with no word, and starts at 0', () => {
    const { room, at } = game({ cycles: 1 });
    const drawing = choose(room, at);
    const word = secretWord(drawing);
    const { room: r, pid: dee } = join(drawing, at + 5_000);
    const view = toView(r, { kind: 'player', pid: dee }, at + 5_000);
    expect(view.phase).toBe('DRAWING');
    expect(view.turn?.drawerPid).toBe(r.turn!.drawerPid);
    expect(r.players[dee]!.score).toBe(0);
    expect(JSON.stringify(view)).not.toContain(word);
  });
});

describe('late joiners in the turn order', () => {
  it('a join in LOBBY leaves the order to Start', () => {
    const base = withPlayers(['Ana', 'Ben']);
    const { room, pid: dee } = join(base.room, T0 + 10);
    expect(room.turnOrder).toEqual([]);
    const started = step(room, { type: 'host:start', by: SCREEN_HOST }, T0 + 1000).room;
    expect(started.turnOrder).toEqual([...base.pids, dee]);
  });

  it('a join while a turn remains after the current one is appended to this cycle', () => {
    const { room, pids, at } = game({ cycles: 2 });
    const drawing = choose(room, at);
    const { room: r, pid: dee } = join(drawing, at + 1_000);
    expect(r.turnOrder).toEqual([...pids, dee]);
    expect(playToFinal(r, at + 1_000).drawers).toEqual([...pids, dee, ...pids, dee]);
  });

  it('a join during CHOOSING with a turn remaining is appended too', () => {
    const { room, pids, at } = game({ cycles: 1 });
    const { room: r, pid: dee } = join(room, at + 500);
    expect(r.turnOrder).toEqual([...pids, dee]);
    expect(playToFinal(r, at + 500).drawers).toEqual([...pids, dee]);
  });

  it('a place after the current turn counts even if its player is disconnected', () => {
    const { room, pids, at } = game({ cycles: 1 });
    // Ana draws; Ben and Cy, the places after her, are both away (F41: too few players pauses).
    let r = step(choose(room, at), { type: 'sys:disconnected', pid: pids[1]! }, at).room;
    r = step(r, { type: 'sys:disconnected', pid: pids[2]! }, at).room;
    expect(r.paused?.reasons).toEqual(['fewPlayers']);
    const { room: joined, pid: dee } = join(r, at + 1_000);
    expect(joined.turnOrder).toEqual([...pids, dee]);
    // Dee makes two: the 3-2-1, then the turn goes on.
    const goAt = joined.paused!.resumeAt!;
    const resumed = step(joined, timer(joined, 'resumeGo'), goAt).room;
    // Ben and Cy are skipped; Dee's is the one extra turn.
    expect(playToFinal(resumed, goAt).drawers).toEqual([pids[0], dee]);
  });

  it('a join during the cycle’s last turn draws from the next cycle', () => {
    const { room, pids, at } = game({ cycles: 2 });
    let r = room;
    for (let i = 0; i < 2; i++) r = step(playTurn(r, at), NEXT, at).room;
    expect(r.turn!.drawerPid).toBe(pids[2]);
    const joined = join(choose(r, at), at + 1_000);
    expect(joined.room.turnOrder).toEqual(pids);
    expect(playToFinal(joined.room, at + 1_000).drawers).toEqual([pids[2], ...pids, joined.pid]);
  });

  it('a join during the last turn of the last cycle only guesses', () => {
    const { room, pids, at } = game({ cycles: 2 });
    let r = room;
    // Cycle 1, the scoreboard, then two turns of cycle 2.
    for (let i = 0; i < 3; i++) r = step(playTurn(r, at), NEXT, at).room;
    r = step(r, NEXT, at).room;
    for (let i = 0; i < 2; i++) r = step(playTurn(r, at), NEXT, at).room;
    expect([r.cycle, r.turn!.drawerPid]).toEqual([2, pids[2]]);
    const joined = join(choose(r, at), at + 1_000);
    expect(joined.room.turnOrder).toEqual(pids);
    const { room: final, drawers } = playToFinal(joined.room, at + 1_000);
    expect(drawers).toEqual([pids[2]]);
    expect(final.phase).toBe('FINAL');
  });

  it('a join during REVEAL with this cycle’s next turn dealt is appended after it', () => {
    const { room, pids, at } = game({ cycles: 1 });
    const reveal = playTurn(room, at);
    expect(reveal.upcoming?.drawerPid).toBe(pids[1]);
    const { room: r, pid: dee } = join(reveal, at + 1_000);
    expect(r.turnOrder).toEqual([...pids, dee]);
    expect(playToFinal(r, at + 1_000).drawers).toEqual([pids[1], pids[2], dee]);
  });

  it('a join during REVEAL with the next cycle’s first turn dealt draws in that cycle, once', () => {
    const { room, pids, at } = game({ cycles: 2 });
    let r = room;
    for (let i = 0; i < 2; i++) r = step(playTurn(r, at), NEXT, at).room;
    r = playTurn(r, at);
    expect([r.phase, r.upcoming?.cycle]).toEqual(['REVEAL', 2]);
    const { room: joined, pid: dee } = join(r, at + 1_000);
    expect(joined.turnOrder).toEqual([...pids, dee]);
    expect(playToFinal(joined, at + 1_000).drawers).toEqual([...pids, dee]);
  });

  it('a join during SCOREBOARD draws in the next cycle, once', () => {
    const { room, pids, at } = game({ cycles: 2 });
    let r = room;
    for (let i = 0; i < 3; i++) r = step(playTurn(r, at), NEXT, at).room;
    expect(r.phase).toBe('SCOREBOARD');
    const { room: joined, pid: dee } = join(r, at + 1_000);
    expect(joined.turnOrder).toEqual([...pids, dee]);
    expect(playToFinal(joined, at + 1_000).drawers).toEqual([...pids, dee]);
  });

  it('a join during the game’s last REVEAL only guesses: the game ends', () => {
    const { room, at } = game({ cycles: 1 });
    let r = room;
    for (let i = 0; i < 2; i++) r = step(playTurn(r, at), NEXT, at).room;
    r = playTurn(r, at);
    expect([r.phase, r.upcoming]).toEqual(['REVEAL', null]);
    const joined = join(r, at + 1_000).room;
    expect(step(joined, NEXT, at + 2_000).room.phase).toBe('FINAL');
  });

  it('a join never makes the game longer than one extra turn each', () => {
    const { room, at } = game({ cycles: 2 });
    let r = choose(room, at);
    r = join(r, at + 1_000, 'Dee').room;
    r = join(r, at + 2_000, 'Eli').room;
    // Two joiners: at most two extra turns a cycle, one each.
    expect(playToFinal(r, at + 2_000).drawers).toHaveLength(10);
  });

  it('a phone rejoining or taking over a name is not appended again', () => {
    const { room, pids, at } = game({ cycles: 1 });
    const { room: r1, pid: dee } = join(room, at + 500);
    // The same phone again (a refresh), and Ben's name taken over from a new phone.
    let r = step(
      r1,
      { type: 'player:join', by: NEW_PHONE, keyHash: 'key-Dee', name: 'Dee', avatar: '🦊' },
      at + 600,
    ).room;
    r = step(r, { type: 'sys:disconnected', pid: pids[1]! }, at + 700).room;
    r = step(
      r,
      {
        type: 'player:join',
        by: NEW_PHONE,
        keyHash: 'key-new',
        name: 'Ben',
        avatar: '🦊',
        takeOver: true,
      },
      at + 800,
    ).room;
    expect(r.turnOrder).toEqual([...pids, dee]);
  });
});

describe('disconnects and leaves', () => {
  it('a disconnected player is skipped when their turn comes and draws again next cycle', () => {
    const { room, pids, at } = game({ cycles: 2 });
    let r = step(room, { type: 'sys:disconnected', pid: pids[1]! }, at).room;
    r = playTurn(r, at);
    // Ben is skipped at the deal: Cy is next.
    expect(r.upcoming?.drawerPid).toBe(pids[2]);
    r = step(r, NEXT, at).room;
    r = step(r, { type: 'sys:connected', pid: pids[1]! }, at).room;
    // Back in time for Cy's turn, Ben still doesn't draw this cycle.
    const { drawers } = playToFinal(r, at);
    expect(drawers).toEqual([pids[2], ...pids]);
  });

  it('a player who disconnects after being dealt is skipped at take-up', () => {
    const { room, pids, at } = game({ cycles: 1 });
    let r = playTurn(room, at);
    expect(r.upcoming?.drawerPid).toBe(pids[1]);
    r = step(r, { type: 'sys:disconnected', pid: pids[1]! }, at).room;
    r = step(r, NEXT, at).room;
    expect([r.phase, r.turn!.drawerPid]).toEqual(['CHOOSING', pids[2]]);
  });

  it('a player who leaves is removed from the order and never drawn', () => {
    const { room, pids, at } = game({ cycles: 2 });
    const r = step(room, { type: 'player:leave', by: asPlayer(pids[1]!) }, at).room;
    expect(r.turnOrder).toEqual([pids[0], pids[2]]);
    expect(playToFinal(r, at).drawers).toEqual([pids[0], pids[2], pids[0], pids[2]]);
  });

  it('a late joiner who leaves is removed from the order', () => {
    const { room, pids, at } = game({ cycles: 1 });
    const { room: r1, pid: dee } = join(choose(room, at), at + 1_000);
    const r = step(r1, { type: 'player:leave', by: asPlayer(dee) }, at + 2_000).room;
    expect(r.turnOrder).toEqual(pids);
    expect(playToFinal(r, at + 2_000).drawers).toEqual(pids);
  });
});

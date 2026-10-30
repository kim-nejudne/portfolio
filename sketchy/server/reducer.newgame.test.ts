// The new-game reset (F29), shared by Rematch and Back to lobby: "New-game reset" under
// Transitions in docs/spec.md.
import { describe, expect, it } from 'vitest';
import { REMATCH_COUNTDOWN_MS } from '../shared/constants.js';
import type { Action, Effect, Room } from '../shared/types.js';
import { reduce } from './reducer.js';
import { toView } from './views.js';
import { SCREEN, SCREEN_HOST, asPlayer, dealt, inPhase, secretWord, step } from './test/rooms.js';

const LOBBY: Action = { type: 'host:backToLobby', by: SCREEN_HOST };
const START: Action = { type: 'host:start', by: SCREEN_HOST };

type Schedule = Extract<Effect, { type: 'schedule' }>;

function rematch(room: Room, t: number): Room {
  const counting = step(room, { type: 'host:rematch', by: SCREEN_HOST }, t);
  const go = counting.effects.find(
    (e): e is Schedule => e.type === 'schedule' && e.timer === 'rematchGo',
  )!;
  return step(
    counting.room,
    { type: 'timer', timer: 'rematchGo', turnId: go.turnId, epoch: go.epoch },
    t + REMATCH_COUNTDOWN_MS,
  ).room;
}

/**
 * Plays every turn of the game in progress from `t`: the drawer takes the first word and the
 * second player in the room guesses it when they can, else the host skips. Ends at FINAL.
 */
function playOut(room: Room, t: number): { room: Room; t: number } {
  const guesser = Object.keys(room.players)[1]!;
  for (let guard = 0; room.phase !== 'FINAL' && guard < 100; guard++) {
    t += 1000;
    if (room.phase === 'CHOOSING') {
      room = step(
        room,
        { type: 'drawer:choose', by: asPlayer(room.turn!.drawerPid), index: 0 },
        t,
      ).room;
    } else if (room.phase === 'DRAWING') {
      const by = room.turn!.drawerPid === guesser ? Object.keys(room.players)[0]! : guesser;
      room = step(
        room,
        {
          type: 'player:guess',
          by: asPlayer(by),
          text: secretWord(room),
          receivedAt: t,
          oneWayMs: 0,
        },
        t,
      ).room;
      room = step(room, { type: 'host:skip', by: SCREEN_HOST }, t + 1).room;
    } else {
      room = step(room, { type: 'host:next', by: SCREEN_HOST }, t).room;
    }
  }
  expect(room.phase).toBe('FINAL');
  return { room, t };
}

/** A whole 3-player game (Ana, Ben, Cy) from the lobby, played to FINAL. */
function gameOne() {
  const { room, pids, at } = dealt();
  return { ...playOut(room, at), pids };
}

describe('host:backToLobby', () => {
  it('keeps players, crown, settings, custom words, doodles and used words; clears the game', () => {
    const base = gameOne();
    let r = base.room;
    const final = r;
    const res = step(r, LOBBY, base.t + 1000);
    r = res.room;
    expect(r.phase).toBe('LOBBY');
    expect(Object.keys(r.players)).toEqual(Object.keys(final.players));
    expect(r.crownPid).toBe(final.crownPid);
    expect(r.settings).toEqual(final.settings);
    expect(r.customWords).toEqual(final.customWords);
    expect(r.deck.usedIds).toEqual(final.deck.usedIds);
    expect(r.deck.usedIds.length).toBeGreaterThan(0);
    expect(r.history).toEqual([]);
    expect(r.awards).toEqual([]);
    expect(r.turn).toBeNull();
    expect(r.upcoming).toBeNull();
    expect(r.cycle).toBe(0);
    expect(r.rematchAt).toBeNull();
    expect(Object.values(r.players).every((p) => p.score === 0)).toBe(true);
    expect(r.session.gameNumber).toBe(2);
    for (const p of Object.values(final.players)) {
      expect(r.session.totals[p.pid]).toBe(p.score);
      expect(r.session.players[p.pid]).toEqual({
        name: p.name,
        color: p.color,
        joinedAt: p.joinedAt,
      });
    }
    expect(res.effects).toContainEqual({ type: 'inkReset' });
    expect(r.timerEpoch).toBeGreaterThan(final.timerEpoch);
  });

  it('keeps each player’s hasDoodle through the reset (the InkStore keeps the doodles)', () => {
    const game = dealt();
    const { pids } = game;
    // Doodles are drawn in the lobby; go back to it after game 1 and doodle there.
    let room = playOut(game.room, game.at).room;
    room = step(room, LOBBY, 5_000_000).room;
    room = step(room, { type: 'sys:doodle', pid: pids[0]!, has: true }, 5_000_001).room;
    room = step(room, START, 5_000_002).room;
    room = playOut(room, 5_000_002).room;
    expect(room.players[pids[0]!]!.hasDoodle).toBe(true);
    const back = step(room, LOBBY, 6_000_000).room;
    expect(back.players[pids[0]!]!.hasDoodle).toBe(true);
    expect(back.players[pids[1]!]!.hasDoodle).toBe(false);
    const again = rematch(room, 6_000_000);
    expect(again.players[pids[0]!]!.hasDoodle).toBe(true);
  });

  it('a game started from the lobby again begins with the earliest joiner', () => {
    const { room, pids, t } = gameOne();
    const lobby = step(room, LOBBY, t + 1000).room;
    const r = step(lobby, START, t + 2000).room;
    expect(r.turn!.drawerPid).toBe(pids[0]);
    expect(r.turnOrder).toEqual(pids);
    expect(r.rotateAfter).toBeNull();
  });

  it('settings can change in the lobby afterwards', () => {
    const { room, t } = gameOne();
    const lobby = step(room, LOBBY, t + 1000).room;
    const r = step(
      lobby,
      { type: 'host:settings', by: SCREEN_HOST, drawSeconds: 45 },
      t + 2000,
    ).room;
    expect(r.settings.drawSeconds).toBe(45);
  });

  it('is refused outside FINAL and from a non-host', () => {
    for (const phase of ['CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD'] as const)
      expect(reduce(inPhase(phase), LOBBY, 3_000_000)).toEqual({ ok: false, error: 'wrongPhase' });
    const final = inPhase('FINAL');
    expect(reduce(final, { type: 'host:backToLobby', by: SCREEN }, 3_000_000)).toEqual({
      ok: false,
      error: 'notHost',
    });
  });
});

describe('a new game', () => {
  it('repeats no word across two games, by Rematch or by Back to lobby', () => {
    const one = gameOne();
    const words1 = one.room.history.map((h) => h.word);
    expect(words1.length).toBe(6);

    const viaRematch = playOut(rematch(one.room, one.t + 1000), one.t + 5000).room;
    const viaLobby = playOut(
      step(step(one.room, LOBBY, one.t + 1000).room, START, one.t + 2000).room,
      one.t + 2000,
    ).room;
    for (const game2 of [viaRematch, viaLobby]) {
      const words2 = game2.history.map((h) => h.word);
      expect(words2.length).toBe(6);
      expect(words2.filter((w) => words1.includes(w))).toEqual([]);
      expect(new Set(words2).size).toBe(words2.length);
    }
  });

  it('adds each game to the night’s totals; a player who left keeps theirs', () => {
    const one = gameOne();
    const scores1 = Object.fromEntries(
      Object.values(one.room.players).map((p) => [p.pid, p.score]),
    );
    const r = playOut(rematch(one.room, one.t + 1000), one.t + 5000);
    const scores2 = Object.fromEntries(Object.values(r.room.players).map((p) => [p.pid, p.score]));
    // Cy leaves at game 2's FINAL: that finished game's points are banked with his game 1 total.
    const cy = one.pids[2]!;
    const left = step(r.room, { type: 'player:leave', by: asPlayer(cy) }, r.t + 1).room;
    const three = rematch(left, r.t + 1000);
    expect(three.session.gameNumber).toBe(3);
    expect(three.session.totals[cy]).toBe(scores1[cy]! + scores2[cy]!);
    expect(scores2[cy]).toBeGreaterThan(0);
    expect(three.session.players[cy]!.name).toBe('Cy');
    for (const pid of one.pids.slice(0, 2))
      expect(three.session.totals[pid]).toBe(scores1[pid]! + scores2[pid]!);
  });

  it('a player who leaves mid-game loses that game’s points but keeps earlier totals', () => {
    const one = gameOne();
    const ben = one.pids[1]!;
    const scored = one.room.players[ben]!.score;
    let r = rematch(one.room, one.t + 1000);
    r = step(
      r,
      { type: 'drawer:choose', by: asPlayer(r.turn!.drawerPid), index: 0 },
      one.t + 5000,
    ).room;
    // Ben draws game 2's first turn; Ana guesses it, so Ben earns drawer points, then leaves.
    expect(r.turn!.drawerPid).toBe(ben);
    r = step(
      r,
      {
        type: 'player:guess',
        by: asPlayer(one.pids[0]!),
        text: secretWord(r),
        receivedAt: one.t + 6000,
        oneWayMs: 0,
      },
      one.t + 6000,
    ).room;
    r = step(r, { type: 'player:leave', by: asPlayer(ben) }, one.t + 7000).room;
    expect(r.session.totals[ben]).toBe(scored);
    const ended = step(r, { type: 'host:end', by: SCREEN_HOST }, one.t + 8000).room;
    const row = toView(ended, { kind: 'screen', isHost: false }, one.t + 9000).tonight!.find(
      (x) => x.pid === ben,
    );
    expect(row).toMatchObject({ name: 'Ben', total: scored });
  });

  it('numbers its first turn 1 again (the Screen’s first-turn captions)', () => {
    const one = gameOne();
    expect(toView(one.room, { kind: 'screen', isHost: false }, one.t).turn!.number).toBe(6);
    const viaRematch = rematch(one.room, one.t + 1000);
    expect(toView(viaRematch, { kind: 'screen', isHost: false }, one.t + 5000).turn!.number).toBe(
      1,
    );
    const viaLobby = step(step(one.room, LOBBY, one.t + 1000).room, START, one.t + 2000).room;
    expect(toView(viaLobby, { kind: 'screen', isHost: false }, one.t + 3000).turn!.number).toBe(1);
  });

  it('keeps turn ids rising across games, so old ink and timers never match', () => {
    const one = gameOne();
    const lastId = one.room.turnCounter;
    const r = rematch(one.room, one.t + 1000);
    expect(r.turn!.id).toBe(lastId + 1);
  });
});

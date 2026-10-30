// Host skip, kick and end (F28): Transitions and Actions in docs/spec.md.
import { describe, expect, it } from 'vitest';
import type { Action, Effect, Room } from '../shared/types.js';
import { reduce } from './reducer.js';
import { drawerPoints } from './scoring.js';
import {
  NEW_PHONE,
  SCREEN,
  SCREEN_HOST,
  asPlayer,
  dealt,
  inPhase,
  secretWord,
  started,
  step,
  withPlayers,
} from './test/rooms.js';

const SKIP: Action = { type: 'host:skip', by: SCREEN_HOST };
const END: Action = { type: 'host:end', by: SCREEN_HOST };
const kick = (pid: string, by = SCREEN_HOST): Action => ({ type: 'host:kick', by, pid });

const ofType = <T extends Effect['type']>(effects: Effect[], type: T) =>
  effects.filter((e): e is Extract<Effect, { type: T }> => e.type === type);

/** Ben guesses the word right at `at`. */
function benGets(room: Room, ben: string, at: number): Room {
  return step(
    room,
    {
      type: 'player:guess',
      by: asPlayer(ben),
      text: secretWord(room),
      receivedAt: at,
      oneWayMs: 0,
    },
    at,
  ).room;
}

describe('host:skip', () => {
  it('in CHOOSING deals the next drawer and puts the three words back at the bottom', () => {
    const { room, at } = dealt();
    const ids = room.turn!.choices.map((c) => c.id);
    const res = step(room, SKIP, at + 1000);
    expect(res.room.phase).toBe('CHOOSING');
    expect(res.room.turn!.drawerPid).not.toBe(room.turn!.drawerPid);
    expect(res.room.deck.remaining.slice(-3)).toEqual(ids);
    expect(res.room.history).toEqual([]);
  });

  it('in DRAWING ends the turn as a skip; points earned stay, the drawer’s too', () => {
    const { room, pids, at } = started();
    const got = benGets(room, pids[1]!, at + 6000);
    const ben = got.players[pids[1]!]!.score;
    const res = step(got, SKIP, at + 7000);
    expect(res.room.phase).toBe('REVEAL');
    expect(res.room.turn!.endReason).toBe('skip');
    expect(res.room.players[pids[1]!]!.score).toBe(ben);
    expect(res.room.players[pids[0]!]!.score).toBe(drawerPoints([ben]));
    expect(res.effects).toContainEqual({
      type: 'fx',
      to: 'all',
      fx: { kind: 'turnEnd', reason: 'skip' },
    });
  });

  it('is refused outside CHOOSING and DRAWING, and from a plain Screen', () => {
    for (const phase of ['REVEAL', 'SCOREBOARD', 'FINAL'] as const) {
      expect(reduce(inPhase(phase), SKIP, 2_000_000)).toEqual({ ok: false, error: 'wrongPhase' });
    }
    const { room, at } = started();
    expect(reduce(room, { type: 'host:skip', by: SCREEN }, at)).toEqual({
      ok: false,
      error: 'notHost',
    });
  });
});

describe('host:kick', () => {
  it('removes the player, bars their key, and tells the gateway to kick and drop the doodle', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    const res = step(room, kick(pids[2]!), 2_000_000);
    expect(res.room.players[pids[2]!]).toBeUndefined();
    expect(res.room.kickedKeyHashes).toEqual(['key-Cy']);
    expect(ofType(res.effects, 'kick')).toEqual([{ type: 'kick', pid: pids[2] }]);
    expect(ofType(res.effects, 'doodleDrop')).toEqual([{ type: 'doodleDrop', pid: pids[2] }]);
    const back = reduce(
      res.room,
      { type: 'player:join', by: NEW_PHONE, keyHash: 'key-Cy', name: 'Cy' },
      2_000_001,
    );
    expect(back).toEqual({ ok: false, error: 'kicked' });
  });

  it('works in every phase', () => {
    for (const phase of ['CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD', 'FINAL'] as const) {
      const room = inPhase(phase);
      const guest = Object.values(room.players).find((p) => p.pid !== room.crownPid)!;
      expect(reduce(room, kick(guest.pid), 2_000_000).ok, phase).toBe(true);
    }
  });

  it('is open to the crown holder, not to another player or a plain Screen', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    expect(reduce(room, kick(pids[2]!, asPlayer(pids[0]!, true)), 2_000_000).ok).toBe(true);
    expect(reduce(room, kick(pids[2]!, asPlayer(pids[1]!, true)), 2_000_000)).toEqual({
      ok: false,
      error: 'notHost',
    });
    expect(reduce(room, kick(pids[2]!, SCREEN), 2_000_000)).toEqual({
      ok: false,
      error: 'notHost',
    });
  });

  it('refuses an unknown pid and the crown holder kicking themself', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    expect(reduce(room, kick('pnobody00'), 2_000_000)).toEqual({
      ok: false,
      error: 'unknownPlayer',
    });
    expect(reduce(room, kick(pids[0]!, asPlayer(pids[0]!, true)), 2_000_000)).toEqual({
      ok: false,
      error: 'cannotKickSelf',
    });
  });

  it('passes the crown on when the token Screen kicks its holder', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben', 'Cy']);
    const res = step(room, kick(pids[0]!), 2_000_000);
    expect(res.room.crownPid).toBe(pids[1]);
    expect(res.effects).toContainEqual({
      type: 'fx',
      to: { pid: pids[1] },
      fx: { kind: 'crowned' },
    });
  });

  it('kicking the drawer mid-drawing ends the turn as a skip, with the points earned', () => {
    const { room, pids, at } = started();
    const got = benGets(room, pids[1]!, at + 6000);
    const res = step(got, kick(pids[0]!), at + 7000);
    expect(res.room.phase).toBe('REVEAL');
    expect(res.room.turn!.endReason).toBe('skip');
    expect(res.room.players[pids[1]!]!.score).toBe(got.players[pids[1]!]!.score);
    expect(ofType(res.effects, 'inkClose')).toHaveLength(1);
    expect(ofType(res.effects, 'kick')).toEqual([{ type: 'kick', pid: pids[0] }]);
  });

  it('kicking the drawer while they choose deals the next drawer', () => {
    const { room, pids, at } = dealt();
    const res = step(room, kick(pids[0]!), at + 1000);
    expect(res.room.phase).toBe('CHOOSING');
    expect(res.room.turn!.drawerPid).toBe(pids[1]);
  });

  it('kicking the last guesser without the word ends the turn early', () => {
    const { room, pids, at } = started();
    const got = benGets(room, pids[1]!, at + 6000);
    const res = step(got, kick(pids[2]!), at + 7000);
    expect(res.effects).toContainEqual(expect.objectContaining({ timer: 'allGuessed' }));
  });
});

describe('host:end', () => {
  it('from DRAWING: FINAL, the turn closed as a skip with every point earned so far', () => {
    const { room, pids, at } = started();
    const got = benGets(room, pids[1]!, at + 6000);
    const ben = got.players[pids[1]!]!.score;
    const res = step(got, END, at + 7000);
    expect(res.room.phase).toBe('FINAL');
    expect(res.room.players[pids[1]!]!.score).toBe(ben);
    expect(res.room.players[pids[0]!]!.score).toBe(drawerPoints([ben]));
    expect(res.room.history.map((h) => h.turnId)).toEqual([room.turn!.id]);
    expect(res.room.turn!.endReason).toBe('skip');
    expect(res.room.upcoming).toBeNull();
    expect(ofType(res.effects, 'inkClose')).toEqual([{ type: 'inkClose', turnId: room.turn!.id }]);
    expect(ofType(res.effects, 'schedule')).toEqual([]);
  });

  it('from CHOOSING: FINAL, no turn recorded, the three words back in the deck', () => {
    const { room, at } = dealt();
    const ids = room.turn!.choices.map((c) => c.id);
    const res = step(room, END, at + 1000);
    expect(res.room.phase).toBe('FINAL');
    expect(res.room.history).toEqual([]);
    expect(res.room.deck.remaining.slice(-3)).toEqual(ids);
    expect(ofType(res.effects, 'inkClose')).toEqual([]);
  });

  it('from REVEAL: the upcoming deal is discarded, its words back in the deck', () => {
    const reveal = inPhase('REVEAL');
    const up = reveal.upcoming!;
    const res = step(reveal, END, 2_000_000);
    expect(res.room.phase).toBe('FINAL');
    expect(res.room.upcoming).toBeNull();
    expect(res.room.deck.remaining.slice(-3)).toEqual(up.choices.map((c) => c.id));
    expect(res.room.history).toEqual(reveal.history);
  });

  it('from SCOREBOARD keeps the scores', () => {
    const board = inPhase('SCOREBOARD');
    const res = step(board, END, 2_000_000);
    expect(res.room.phase).toBe('FINAL');
    expect(Object.values(res.room.players).map((p) => p.score)).toEqual(
      Object.values(board.players).map((p) => p.score),
    );
  });

  it('is refused in LOBBY and FINAL, and from a plain Screen', () => {
    const { room } = withPlayers(['Ana', 'Ben']);
    expect(reduce(room, END, 2_000_000)).toEqual({ ok: false, error: 'wrongPhase' });
    expect(reduce(inPhase('FINAL'), END, 2_000_000)).toEqual({ ok: false, error: 'wrongPhase' });
    expect(reduce(inPhase('DRAWING'), { type: 'host:end', by: SCREEN }, 2_000_000)).toEqual({
      ok: false,
      error: 'notHost',
    });
  });

  it('the turn’s later timers are ignored after the end', () => {
    const { room, at } = started();
    const final = step(room, END, at + 1000).room;
    const res = reduce(
      final,
      { type: 'timer', timer: 'drawUp', turnId: room.turn!.id, epoch: room.timerEpoch },
      at + 61_000,
    );
    expect(res).toEqual({ ok: false, error: 'staleTimer' });
  });
});

// Rejoin from another phone (F42): a name held by a disconnected player is offered back
// ("Are you Jun? · Rejoin as Jun"), and `takeOver` hands that pid, score and crown to the new
// device. "Creating and joining a room", "Actions" and "Reconnects" in docs/spec.md.
import { describe, expect, it } from 'vitest';
import {
  MAX_PLAYERS,
  NAME_OF_DISCONNECTED_ERROR,
  RESUME_COUNTDOWN_MS,
} from '../shared/constants.js';
import type { Action, Effect, Room } from '../shared/types.js';
import { reduce } from './reducer.js';
import {
  NEW_PHONE,
  SCREEN_HOST,
  T0,
  asPlayer,
  started,
  step,
  secretWord,
  withPlayers,
} from './test/rooms.js';
import { toView } from './views.js';

const asPhone = (pid: string) => ({ kind: 'player' as const, pid });

const join = (keyHash: string, name: string, takeOver?: boolean): Action => ({
  type: 'player:join',
  by: NEW_PHONE,
  keyHash,
  name,
  avatar: '🦊',
  ...(takeOver === undefined ? {} : { takeOver }),
});
const drop = (pid: string): Action => ({ type: 'sys:disconnected', pid });
const fxOf = (effects: Effect[]) => effects.filter((e) => e.type === 'fx');

/** Ana (crown), Jun and Cy in the lobby, Jun's phone dead (disconnected). */
function junGone(): { room: Room; ana: string; jun: string; cy: string } {
  const { room, pids } = withPlayers(['Ana', 'Jun', 'Cy']);
  const [ana, jun, cy] = pids as [string, string, string];
  return { room: step(room, drop(jun), T0 + 100).room, ana, jun, cy };
}

describe('player:join with the name of a disconnected player', () => {
  it('asks first: nameOfDisconnected, ignoring case, with nothing changed', () => {
    const { room } = junGone();
    for (const name of ['Jun', 'jun', 'JUN']) {
      expect(reduce(room, join('new-phone', name), T0 + 200)).toEqual({
        ok: false,
        error: NAME_OF_DISCONNECTED_ERROR,
      });
    }
  });

  it('takeOver hands the new phone that pid, score, colour and doodle, under the stored name', () => {
    const { room: gone, jun } = junGone();
    const before = { ...gone.players[jun]!, score: 420, hasDoodle: true };
    const room = { ...gone, players: { ...gone.players, [jun]: before } };
    const { room: after, effects } = step(room, join('new-phone', 'jun', true), T0 + 200);

    expect(Object.keys(after.players)).toHaveLength(3);
    expect(after.players[jun]).toEqual({ ...before, keyHash: 'new-phone', connected: true });
    // The new keyHash replaces the old one: no player keeps the dead phone's key.
    expect(Object.values(after.players).some((p) => p.keyHash === 'key-Jun')).toBe(false);
    expect(fxOf(effects)).toEqual([
      { type: 'fx', to: 'screen', fx: { kind: 'rejoined', pid: jun } },
    ]);
  });

  it('hands over the crown too', () => {
    const { room: joined, pids } = withPlayers(['Jun', 'Ben']);
    const [jun] = pids as [string];
    // Disconnecting never passes the crown on.
    const room = step(joined, drop(jun), T0 + 100).room;
    expect(room.crownPid).toBe(jun);
    const after = step(room, join('new-phone', 'Jun', true), T0 + 200).room;
    expect(after.crownPid).toBe(jun);
    expect(toView(after, asPhone(jun), T0 + 200).host).not.toBeNull();
  });

  it('carries the new phone’s hidden flag', () => {
    const { room, jun } = junGone();
    const after = step(
      room,
      { ...join('new-phone', 'Jun', true), hidden: true } as Action,
      T0 + 200,
    );
    expect(after.room.players[jun]!.hidden).toBe(true);
  });

  it('works in a full room, since nobody is added', () => {
    const names = Array.from({ length: MAX_PLAYERS }, (_, i) => `P${i}`);
    const { room: full, pids } = withPlayers(names);
    const room = step(full, drop(pids[4]!), T0 + 100).room;
    expect(reduce(room, join('new-phone', 'P4'), T0 + 200)).toEqual({
      ok: false,
      error: NAME_OF_DISCONNECTED_ERROR,
    });
    expect(
      step(room, join('new-phone', 'P4', true), T0 + 200).room.players[pids[4]!]!.connected,
    ).toBe(true);
  });
});

describe('names that are not offered', () => {
  it('a connected player’s name stays blocked, takeOver or not', () => {
    const { room } = withPlayers(['Ana', 'Jun']);
    expect(reduce(room, join('new-phone', 'jun'), T0 + 200)).toEqual({
      ok: false,
      error: 'nameTaken',
    });
    expect(reduce(room, join('new-phone', 'jun', true), T0 + 200)).toEqual({
      ok: false,
      error: 'nameTaken',
    });
  });

  it('once taken over, the old phone can’t come back as Jun', () => {
    const { room, jun } = junGone();
    const after = step(room, join('new-phone', 'Jun', true), T0 + 200).room;
    // The dead phone charges and rejoins with its old key: not Jun any more, and the name is taken.
    expect(reduce(after, join('key-Jun', 'Jun'), T0 + 300)).toEqual({
      ok: false,
      error: 'nameTaken',
    });
    expect(reduce(after, join('key-Jun', 'Jun', true), T0 + 300)).toEqual({
      ok: false,
      error: 'nameTaken',
    });
    // Should the new phone die too, the old one is offered the name like any other phone.
    const newGone = step(after, drop(jun), T0 + 400).room;
    expect(reduce(newGone, join('key-Jun', 'Jun'), T0 + 500)).toEqual({
      ok: false,
      error: NAME_OF_DISCONNECTED_ERROR,
    });
  });

  it('a kicked player was removed: the name is free and joins as someone new', () => {
    const { room: gone, jun } = junGone();
    const kicked = step(gone, { type: 'host:kick', by: SCREEN_HOST, pid: jun }, T0 + 150).room;
    for (const takeOver of [undefined, true]) {
      const { room: after, effects } = step(kicked, join('new-phone', 'Jun', takeOver), T0 + 200);
      const newJun = Object.values(after.players).find((p) => p.name === 'Jun')!;
      expect(newJun.pid).not.toBe(jun);
      expect(newJun.score).toBe(0);
      expect(fxOf(effects).some((e) => e.fx.kind === 'rejoined')).toBe(false);
    }
    // The kicked phone itself stays out.
    expect(reduce(kicked, join('key-Jun', 'Jun', true), T0 + 200)).toEqual({
      ok: false,
      error: 'kicked',
    });
  });

  it('a player who left was removed too: their name joins as someone new', () => {
    const { room: joined, pids } = withPlayers(['Ana', 'Jun']);
    const left = step(joined, { type: 'player:leave', by: asPlayer(pids[1]!) }, T0 + 100).room;
    const after = step(left, join('new-phone', 'Jun', true), T0 + 200).room;
    expect(Object.values(after.players).find((p) => p.name === 'Jun')!.pid).not.toBe(pids[1]);
  });

  it('takeOver on a free name is an ordinary join', () => {
    const { room } = withPlayers(['Ana']);
    const { room: after, effects } = step(room, join('new-phone', 'Bea', true), T0 + 200);
    expect(Object.keys(after.players)).toHaveLength(2);
    expect(fxOf(effects).some((e) => e.fx.kind === 'rejoined')).toBe(false);
  });
});

describe('takeOver mid-game', () => {
  it('a guesser keeps their score, place in the turn order and correct guess this turn', () => {
    const { room: playing, pids, at } = started(['Ana', 'Jun', 'Cy']);
    const [, jun] = pids as [string, string];
    const word = secretWord(playing);
    const guessed = step(
      playing,
      { type: 'player:guess', by: asPlayer(jun), text: word, receivedAt: at + 5000, oneWayMs: 0 },
      at + 5000,
    ).room;
    const score = guessed.players[jun]!.score;
    expect(score).toBeGreaterThan(0);
    const gone = step(guessed, drop(jun), at + 6000).room;
    const { room: after, effects } = step(gone, join('new-phone', 'Jun', true), at + 7000);

    expect(after.players[jun]!.score).toBe(score);
    expect(after.turnOrder).toEqual(guessed.turnOrder);
    expect(toView(after, asPhone(jun), at + 7000).players.find((c) => c.pid === jun)).toMatchObject(
      { connected: true, guessed: true },
    );
    // A second correct guess from the new phone is refused as already guessed.
    expect(
      reduce(
        after,
        { type: 'player:guess', by: asPlayer(jun), text: word, receivedAt: at + 8000, oneWayMs: 0 },
        at + 8000,
      ),
    ).toEqual({ ok: false, error: 'alreadyGuessed' });
    // The Screen hears only the pid: no word in the effect.
    expect(JSON.stringify(fxOf(effects))).not.toContain(word);
  });

  it('the drawer on a new phone ends the drawerAway pause into the 3-2-1', () => {
    const { room, pids, at } = started(['Jun', 'Ben', 'Cy']);
    const [jun] = pids as [string];
    expect(room.turn!.drawerPid).toBe(jun);
    const gone = step(room, drop(jun), at + 5000);
    const check = gone.effects.find((e) => e.type === 'schedule' && e.timer === 'drawerAwayCheck');
    if (check?.type !== 'schedule') throw new Error('no drawerAwayCheck');
    const paused = step(
      gone.room,
      { type: 'timer', timer: check.timer, turnId: check.turnId, epoch: check.epoch },
      check.at,
    ).room;
    expect(paused.paused?.reasons).toEqual(['drawerAway']);

    const back = step(paused, join('new-phone', 'Jun', true), at + 9000).room;
    expect(back.paused).toMatchObject({ reasons: [], resumeAt: at + 9000 + RESUME_COUNTDOWN_MS });
    expect(back.turn!.drawerPid).toBe(jun);
    expect(back.drawerAway).toBeNull();
    // The new phone is the drawer: the word reaches it, and only it.
    expect(toView(back, asPhone(jun), at + 9000).secret?.word?.word).toBe(secretWord(back));
  });
});

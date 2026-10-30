import { describe, expect, it } from 'vitest';
import { CHOOSE_MS, GRACE_MS } from '../shared/constants.js';
import type { Action, Room, RoomSettings, Turn } from '../shared/types.js';
import { reduce } from './reducer.js';
import { EN_PACK, TL_PACK, testPack } from './test/packs.js';
import {
  SCREEN,
  SCREEN_HOST,
  T0,
  asPlayer,
  choose,
  dealt,
  makeRoom,
  started,
  step,
  withPlayers,
} from './test/rooms.js';

const chooseUp = (room: Room): Action => ({
  type: 'timer',
  timer: 'chooseUp',
  turnId: room.turn!.id,
  epoch: room.timerEpoch,
});

const pick = (room: Room, pid: string, index: 0 | 1 | 2): Action => ({
  type: 'drawer:choose',
  by: asPlayer(pid),
  index,
});

/** A room in the lobby with these settings, Ana, Ben and Cy joined. */
const lobbyWith = (settings: Partial<RoomSettings>) =>
  withPlayers(
    ['Ana', 'Ben', 'Cy'],
    makeRoom({ settings: { ...makeRoom().settings, ...settings } }),
  );

const levels = (turn: Turn) => turn.choices.map((c) => c.difficulty);

describe('the deal: LOBBY → CHOOSING', () => {
  it('deals the first drawer three choices, easy, medium and hard in Mixed, with no word yet', () => {
    const { room, pids, at } = dealt();
    expect(room.phase).toBe('CHOOSING');
    expect(room.turn).toMatchObject({
      drawerPid: pids[0],
      dealtAt: at,
      word: null,
      clockStart: null,
      endsAt: null,
    });
    expect(levels(room.turn!)).toEqual([1, 2, 3]);
  });

  it('tells the drawer and schedules chooseUp 12 s after the deal; no ink until a word is set', () => {
    const { room: lobby, pids } = withPlayers(['Ana', 'Ben']);
    const at = T0 + 500;
    const { room, effects } = step(lobby, { type: 'host:start', by: SCREEN_HOST }, at);
    expect(effects).toContainEqual({ type: 'fx', to: { pid: pids[0] }, fx: { kind: 'yourTurn' } });
    expect(effects).toContainEqual({
      type: 'schedule',
      at: at + CHOOSE_MS,
      timer: 'chooseUp',
      turnId: room.turn!.id,
      epoch: room.timerEpoch,
    });
    expect(effects.some((e) => e.type === 'inkOpen')).toBe(false);
  });

  it('deals three easy words in Easy', () => {
    const { room: lobby } = lobbyWith({ difficulty: 'easy' });
    const { room } = step(lobby, { type: 'host:start', by: SCREEN_HOST }, T0 + 100);
    expect(levels(room.turn!)).toEqual([1, 1, 1]);
  });

  it('deals only from the packs the language setting allows', () => {
    for (const [words, lang] of [
      ['en', 'en'],
      ['taglish', 'tl'],
    ] as const) {
      const { room: lobby } = lobbyWith({ words });
      const { room } = step(lobby, { type: 'host:start', by: SCREEN_HOST }, T0 + 100);
      expect(room.turn!.choices.map((c) => c.lang)).toEqual([lang, lang, lang]);
      const ids = new Set((lang === 'en' ? EN_PACK : TL_PACK).words.map((w) => w.id));
      expect(
        [...room.deck.remaining, ...room.turn!.choices.map((c) => c.id)].every((id) => ids.has(id)),
      ).toBe(true);
    }
  });

  it('builds the deck without the words already used this session', () => {
    const used = EN_PACK.words.slice(0, 10).map((w) => w.id);
    const { room: lobby } = withPlayers(
      ['Ana', 'Ben'],
      makeRoom({ deck: { remaining: [], usedIds: used } }),
    );
    const { room } = step(lobby, { type: 'host:start', by: SCREEN_HOST }, T0 + 100);
    const inPlay = [...room.deck.remaining, ...room.turn!.choices.map((c) => c.id)];
    expect(inPlay.some((id) => used.includes(id))).toBe(false);
    expect(room.deck.usedIds).toEqual(used);
  });

  it('refuses to start when the settings leave fewer than 3 words', () => {
    const tiny = testPack('tiny', 'en', 'family', [
      ['apple', 1],
      ['house', 1],
      ['umbrella', 2],
    ]);
    const { room: lobby } = withPlayers(
      ['Ana', 'Ben'],
      makeRoom({ packs: [tiny], settings: { ...makeRoom().settings, difficulty: 'easy' } }),
    );
    expect(reduce(lobby, { type: 'host:start', by: SCREEN_HOST }, T0)).toEqual({
      ok: false,
      error: 'notEnoughWords',
    });
  });

  it('shares the packs with the room it came from instead of copying them', () => {
    const { room: lobby } = withPlayers(['Ana', 'Ben']);
    const { room } = step(lobby, { type: 'host:start', by: SCREEN_HOST }, T0);
    expect(room.packs).toBe(lobby.packs);
  });
});

describe('drawer:choose', () => {
  it('sets the chosen word and starts drawing at once', () => {
    const { room, pids, at } = dealt();
    const { room: after } = step(room, pick(room, pids[0]!, 2), at + 3_000);
    expect(after.phase).toBe('DRAWING');
    expect(after.turn!.word).toEqual(room.turn!.choices[2]);
    expect(after.turn!.clockStart).toBe(at + 3_000);
    expect(after.timerEpoch).toBe(room.timerEpoch + 1);
  });

  it('uses up only the chosen word; the other two go to the bottom of the deck', () => {
    const { room, pids, at } = dealt();
    const [easy, medium, hard] = room.turn!.choices;
    const { room: after } = step(room, pick(room, pids[0]!, 1), at);
    expect(after.deck.usedIds).toEqual([medium.id]);
    expect(after.deck.remaining).toEqual([...room.deck.remaining, easy.id, hard.id]);
  });

  it('is refused from anyone but the drawer', () => {
    const { room, pids, at } = dealt();
    expect(reduce(room, pick(room, pids[1]!, 0), at)).toEqual({ ok: false, error: 'notDrawer' });
    expect(reduce(room, { type: 'drawer:choose', by: SCREEN, index: 0 }, at)).toEqual({
      ok: false,
      error: 'notPlayer',
    });
  });

  it('is refused outside CHOOSING, and a second time', () => {
    const { room: lobby, pids } = withPlayers(['Ana', 'Ben']);
    expect(reduce(lobby, pick(lobby, pids[0]!, 0), T0)).toEqual({ ok: false, error: 'wrongPhase' });
    const { room, at } = started();
    expect(reduce(room, pick(room, room.turn!.drawerPid, 1), at)).toEqual({
      ok: false,
      error: 'wrongPhase',
    });
  });

  it('is refused while paused', () => {
    const { room, pids, at } = dealt();
    const paused: Room = {
      ...room,
      paused: { reasons: ['host'], since: at, remainingMs: 10_000, resumeAt: null },
    };
    expect(reduce(paused, pick(paused, pids[0]!, 0), at)).toEqual({ ok: false, error: 'paused' });
  });
});

describe('chooseUp: the auto-pick', () => {
  it('picks the easiest of the three when the drawer has not tapped', () => {
    const { room, at } = dealt();
    const { room: after, effects } = step(room, chooseUp(room), at + CHOOSE_MS);
    expect(after.phase).toBe('DRAWING');
    expect(after.turn!.word!.difficulty).toBe(1);
    expect(after.turn!.word).toEqual(room.turn!.choices[0]);
    expect(after.deck.usedIds).toEqual([room.turn!.choices[0].id]);
    expect(effects).toContainEqual({
      type: 'schedule',
      at: at + CHOOSE_MS + 60_000 + GRACE_MS,
      timer: 'drawUp',
      turnId: room.turn!.id,
      epoch: after.timerEpoch,
    });
    expect(effects).toContainEqual({
      type: 'inkOpen',
      turnId: room.turn!.id,
      drawerPid: room.turn!.drawerPid,
    });
  });

  it('picks the easiest wherever it sits among the choices', () => {
    const { room, at } = dealt();
    const [easy, medium, hard] = room.turn!.choices;
    const shuffled: Room = { ...room, turn: { ...room.turn!, choices: [hard, medium, easy] } };
    const { room: after } = step(shuffled, chooseUp(shuffled), at + CHOOSE_MS);
    expect(after.turn!.word).toEqual(easy);
    expect(after.deck.remaining.slice(-2)).toEqual([hard.id, medium.id]);
  });

  it('counts a custom word as medium', () => {
    const { room, at } = dealt();
    const [easy, , hard] = room.turn!.choices;
    const custom = { ...easy, id: 'custom/1', word: 'lola', lang: 'custom' as const };
    const withCustom: Room = {
      ...room,
      turn: { ...room.turn!, choices: [hard, custom, { ...hard, id: 'x', difficulty: 2 }] },
    };
    const { room: after } = step(withCustom, chooseUp(withCustom), at + CHOOSE_MS);
    expect(after.turn!.word!.id).toBe('custom/1');
  });

  it('does not pick while paused', () => {
    const { room, at } = dealt();
    const paused: Room = {
      ...room,
      paused: { reasons: ['host'], since: at, remainingMs: 5_000, resumeAt: null },
    };
    expect(reduce(paused, chooseUp(paused), at + CHOOSE_MS)).toEqual({
      ok: false,
      error: 'paused',
    });
  });

  it('is ignored once the drawer has chosen', () => {
    const { room, at } = dealt();
    const timer = chooseUp(room);
    const chosen = choose(room, at + 2_000, 2);
    expect(reduce(chosen, timer, at + CHOOSE_MS)).toEqual({ ok: false, error: 'staleTimer' });
  });
});

describe('ending CHOOSING without a word', () => {
  it('host:skip puts the three words back and deals the next drawer, with no reveal or points', () => {
    const { room, pids, at } = dealt();
    const dealtIds = room.turn!.choices.map((c) => c.id);
    const { room: after, effects } = step(room, { type: 'host:skip', by: SCREEN_HOST }, at + 1_000);
    expect(after.phase).toBe('CHOOSING');
    expect(after.turn!.drawerPid).toBe(pids[1]);
    expect(after.turn!.dealtAt).toBe(at + 1_000);
    expect(after.history).toEqual([]);
    expect(Object.values(after.players).every((p) => p.score === 0)).toBe(true);
    expect(after.deck.usedIds).toEqual([]);
    // Back at the bottom, behind everything still in the deck; the next deal came off the top.
    expect(after.deck.remaining.slice(-3)).toEqual(dealtIds);
    expect(effects).toContainEqual({ type: 'fx', to: { pid: pids[1] }, fx: { kind: 'yourTurn' } });
    expect(effects.some((e) => e.type === 'fx' && e.fx.kind === 'turnEnd')).toBe(false);
  });

  it('host:skip from a non-host is refused', () => {
    const { room, pids, at } = dealt();
    expect(reduce(room, { type: 'host:skip', by: asPlayer(pids[1]!) }, at)).toEqual({
      ok: false,
      error: 'notHost',
    });
  });

  it('the drawer leaving puts the three words back and deals the next drawer', () => {
    const { room, pids, at } = dealt();
    const dealtIds = room.turn!.choices.map((c) => c.id);
    const { room: after } = step(
      room,
      { type: 'player:leave', by: asPlayer(pids[0]!) },
      at + 1_000,
    );
    expect(after.phase).toBe('CHOOSING');
    expect(after.turn!.drawerPid).toBe(pids[1]);
    expect(after.deck.remaining.slice(-3)).toEqual(dealtIds);
  });

  it('skipping the last drawer’s choice of the last cycle ends the game', () => {
    const one = makeRoom();
    const { room, at } = dealt(['Ana', 'Ben'], {
      ...one,
      settings: { ...one.settings, cycles: 1 },
    });
    const second = step(room, { type: 'host:skip', by: SCREEN_HOST }, at + 1_000).room;
    expect(second.phase).toBe('CHOOSING');
    const after = step(second, { type: 'host:skip', by: SCREEN_HOST }, at + 2_000).room;
    expect(after.phase).toBe('FINAL');
  });

  it('ignores the skipped turn’s chooseUp', () => {
    const { room, at } = dealt();
    const timer = chooseUp(room);
    const skipped = step(room, { type: 'host:skip', by: SCREEN_HOST }, at + 1_000).room;
    expect(reduce(skipped, timer, at + CHOOSE_MS)).toEqual({ ok: false, error: 'staleTimer' });
  });
});

describe('running out of words', () => {
  it('reshuffles every allowed word, clears usedIds and tells the Screen once', () => {
    const start = started();
    const { at } = start;
    let { room } = start;
    // Nearly every word has been chosen this session.
    room = { ...room, deck: { remaining: room.deck.remaining.slice(0, 2), usedIds: ['x', 'y'] } };
    // The skip's REVEAL deals the next drawer (F21).
    const { room: after, effects } = step(room, { type: 'host:skip', by: SCREEN_HOST }, at + 1_000);
    expect(after.phase).toBe('REVEAL');
    expect(after.upcoming).not.toBeNull();
    expect(after.deck.usedIds).toEqual([]);
    expect(after.deck.remaining.length + 3).toBe(EN_PACK.words.length + TL_PACK.words.length);
    const notices = effects.filter((e) => e.type === 'fx' && e.fx.kind === 'wordsReshuffled');
    expect(notices).toEqual([{ type: 'fx', to: 'screen', fx: { kind: 'wordsReshuffled' } }]);
  });

  it('does not reshuffle while three words are left', () => {
    const { room, at } = started();
    const three = { ...room, deck: { ...room.deck, remaining: room.deck.remaining.slice(0, 3) } };
    const { room: reveal, effects } = step(
      three,
      { type: 'host:skip', by: SCREEN_HOST },
      at + 1_000,
    );
    expect(reveal.upcoming).not.toBeNull();
    expect(effects.some((e) => e.type === 'fx' && e.fx.kind === 'wordsReshuffled')).toBe(false);
  });

  it('never deals a chosen word again in the same session until the reshuffle', () => {
    const names = ['Ana', 'Ben', 'Cy', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal', 'Ida', 'Jo'];
    const one = makeRoom();
    let { room, at } = dealt(names, { ...one, settings: { ...one.settings, cycles: 1 } });
    const chosen: string[] = [];
    // One game of one cycle, ten turns, each choosing the hardest.
    while (room.phase === 'CHOOSING') {
      room = choose(room, (at += 1_000), 2);
      chosen.push(room.turn!.word!.id);
      room = step(room, { type: 'host:skip', by: SCREEN_HOST }, (at += 1_000)).room;
      room = step(room, { type: 'host:next', by: SCREEN_HOST }, (at += 1_000)).room;
    }
    expect(room.phase).toBe('FINAL');
    expect(chosen).toHaveLength(10);
    expect(new Set(chosen).size).toBe(10);
    expect(room.deck.usedIds).toEqual(chosen);
  });
});

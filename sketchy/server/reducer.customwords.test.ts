// Custom words (spec: Words, Custom words; Word selection). The host adds them in the lobby; the
// deal puts one in every set of three while any remain; no view ever carries more than their count.
import { describe, expect, it } from 'vitest';
import { CUSTOM_WORDS_MAX, DEFAULT_SETTINGS } from '../shared/constants.js';
import type { Action, Room, RoomSettings, Sender, View } from '../shared/types.js';
import { reduce } from './reducer.js';
import {
  SCREEN,
  SCREEN_HOST,
  T0,
  asPlayer,
  choose,
  inPhase,
  makeRoom,
  step,
  withPlayers,
} from './test/rooms.js';
import { toView } from './views.js';

const add = (words: string[], by: Sender = SCREEN_HOST): Action => ({
  type: 'host:customWords',
  by,
  words,
});
const clearAll: Action = { type: 'host:customWords', by: SCREEN_HOST, words: [], clear: true };

/** Ana (crown), Ben and Cy in the lobby with these custom words and settings. */
function lobby(words: string[] = [], settings: Partial<RoomSettings> = {}, room = makeRoom()) {
  const joined = withPlayers(['Ana', 'Ben', 'Cy'], {
    ...room,
    settings: { ...DEFAULT_SETTINGS, ...settings },
  });
  const r = words.length ? step(joined.room, add(words), T0 + 100).room : joined.room;
  return { room: r, pids: joined.pids };
}

const isCustom = (w: { lang: string }) => w.lang === 'custom';

/** Plays turn after turn (choose the first card, skip to the next deal), collecting each deal. */
function deals(room: Room, count: number) {
  let r = step(room, { type: 'host:start', by: SCREEN_HOST }, T0 + 1000).room;
  let t = T0 + 1000;
  const out: Room['turn'][] = [];
  for (let i = 0; i < count; i++) {
    out.push(structuredClone(r.turn));
    t += 1000;
    r = choose(r, t, 0);
    t += 1000;
    r = step(r, { type: 'host:skip', by: SCREEN_HOST }, t).room;
    // REVEAL, and between cycles the SCOREBOARD, until the next deal is up.
    while (r.phase === 'REVEAL' || r.phase === 'SCOREBOARD') {
      t += 1000;
      r = step(r, { type: 'host:next', by: SCREEN_HOST }, t).room;
    }
    if (r.phase !== 'CHOOSING') break;
  }
  return out;
}

describe('host:customWords in the lobby', () => {
  it('adds the words as difficulty 2, lang custom, no alternates, trimmed as typed', () => {
    const { room } = lobby(['Tita Baby', '  lola  ', 'Mang Kanor’s tricycle']);
    expect(room.customWords.map((w) => w.word)).toEqual([
      'Tita Baby',
      'lola',
      'Mang Kanor’s tricycle',
    ]);
    for (const w of room.customWords) {
      expect(w).toMatchObject({ alt: [], difficulty: 2, lang: 'custom' });
      expect(w.id).toMatch(/^custom\//);
      expect(w.gloss).toBeUndefined();
    }
    expect(new Set(room.customWords.map((w) => w.id)).size).toBe(3);
  });

  it('is accepted from the token Screen and the crown phone, refused from anyone else', () => {
    const { room, pids } = lobby();
    const [ana, ben] = pids as [string, string];
    expect(step(room, add(['lola'], asPlayer(ana, true)), T0 + 200).room.customWords).toHaveLength(
      1,
    );
    expect(reduce(room, add(['lola'], SCREEN), T0 + 200)).toEqual({ ok: false, error: 'notHost' });
    expect(reduce(room, add(['lola'], asPlayer(ben)), T0 + 200)).toEqual({
      ok: false,
      error: 'notHost',
    });
    // A phone claiming host without the crown.
    expect(reduce(room, add(['lola'], asPlayer(ben, true)), T0 + 200)).toEqual({
      ok: false,
      error: 'notHost',
    });
  });

  it('adds to the list: a second batch keeps the first', () => {
    const { room } = lobby(['lola']);
    const r = step(room, add(['lolo', 'tita']), T0 + 200).room;
    expect(r.customWords.map((w) => w.word)).toEqual(['lola', 'lolo', 'tita']);
  });

  it('removes duplicates by normalised form, in the batch and against the list', () => {
    const { room } = lobby(['Halo-halo', 'halo halo!', 'Lola', 'ang lola']);
    expect(room.customWords.map((w) => w.word)).toEqual(['Halo-halo', 'Lola']);
    const r = step(room, add(['HALOHALO', 'Lólà', 'lolo']), T0 + 200).room;
    expect(r.customWords.map((w) => w.word)).toEqual(['Halo-halo', 'Lola', 'lolo']);
  });

  it('drops a word that normalises to nothing, since nobody could guess it', () => {
    const { room } = lobby(['the', '!!!', 'ang', 'lola']);
    expect(room.customWords.map((w) => w.word)).toEqual(['lola']);
  });

  it('clear empties the list first; an empty batch without it changes nothing', () => {
    const { room } = lobby(['lola', 'lolo']);
    expect(step(room, clearAll, T0 + 200).room.customWords).toEqual([]);
    // A blank batch (the schema drops "  " and a lone comma to []) must not wipe the list.
    expect(step(room, add([]), T0 + 200).room.customWords).toEqual(room.customWords);
    const replaced = step(room, { ...clearAll, words: ['tita'] }, T0 + 200).room;
    expect(replaced.customWords.map((w) => w.word)).toEqual(['tita']);
  });

  it(`refuses a batch that would take the list over ${CUSTOM_WORDS_MAX}, changing nothing`, () => {
    const many = (from: number, n: number) =>
      Array.from({ length: n }, (_, i) => `word${from + i}`);
    const { room } = lobby(many(0, 90));
    expect(room.customWords).toHaveLength(90);
    expect(reduce(room, add(many(90, 11)), T0 + 200)).toEqual({
      ok: false,
      error: 'tooManyWords',
    });
    // Exactly 100 fits, and duplicates of words already in don't count.
    const full = step(room, add([...many(0, 50), ...many(90, 10)]), T0 + 200).room;
    expect(full.customWords).toHaveLength(CUSTOM_WORDS_MAX);
    // Clearing always works, even when full.
    expect(step(full, clearAll, T0 + 300).room.customWords).toEqual([]);
  });

  it('is refused in every phase but LOBBY', () => {
    for (const phase of ['CHOOSING', 'DRAWING', 'REVEAL', 'FINAL'] as const) {
      const room = inPhase(phase);
      expect(reduce(room, add(['lola']), T0 + 99_000), phase).toEqual({
        ok: false,
        error: 'wrongPhase',
      });
    }
  });

  it('emits no effect: views carry the change', () => {
    const { room } = lobby();
    expect(step(room, add(['lola']), T0 + 200).effects).toEqual([]);
  });
});

describe('custom words never reach a view, only their count', () => {
  const WORDS = ['qzlola', 'qzlolo', 'qztita'];
  const views = (room: Room, pids: string[], now: number): [string, View][] => [
    ['token Screen', toView(room, { kind: 'screen', isHost: true }, now)],
    ['Screen', toView(room, { kind: 'screen', isHost: false }, now)],
    ...pids.map((pid): [string, View] => [pid, toView(room, { kind: 'player', pid }, now)]),
  ];

  it('the lobby: the token Screen and the crown phone get the count, nobody gets a word', () => {
    const { room, pids } = lobby(WORDS);
    for (const [who, view] of views(room, pids, T0 + 200)) {
      expect(JSON.stringify(view), who).not.toMatch(/qz/);
    }
    expect(toView(room, { kind: 'screen', isHost: true }, T0).host?.customWordCount).toBe(3);
    expect(toView(room, { kind: 'player', pid: pids[0]! }, T0).host?.customWordCount).toBe(3);
    expect(toView(room, { kind: 'screen', isHost: false }, T0).host).toBeNull();
    expect(toView(room, { kind: 'player', pid: pids[1]! }, T0).host).toBeNull();
  });

  it('the deal: only the drawer sees the custom choice, marked as ours', () => {
    const { room: l, pids } = lobby(WORDS);
    const room = step(l, { type: 'host:start', by: SCREEN_HOST }, T0 + 1000).room;
    const drawer = room.turn!.drawerPid;
    const custom = room.turn!.choices.find(isCustom)!;
    for (const [who, view] of views(room, pids, T0 + 1000)) {
      const tokens = JSON.stringify(view).match(/qz[a-z]+/g) ?? [];
      expect(tokens, who).toEqual(who === drawer ? [custom.word] : []);
    }
    const mine = toView(room, { kind: 'player', pid: drawer }, T0 + 1000);
    expect(mine.secret!.choices!.map((c) => c.custom)).toEqual(
      room.turn!.choices.map((c) => isCustom(c)),
    );
  });
});

describe('the deal with custom words', () => {
  const WORDS = ['lola', 'lolo', 'tita', 'tito'];

  it('puts one custom word in each set of three while any remain, then none', () => {
    const { room } = lobby(WORDS, { cycles: 3 });
    const turns = deals(room, 8);
    expect(turns.length).toBe(8);
    // The first card is chosen each time: whether it is the custom one decides how fast they go.
    let left = WORDS.length;
    for (const turn of turns) {
      const customs = turn!.choices.filter(isCustom);
      expect(customs).toHaveLength(left > 0 ? 1 : 0);
      if (customs.length && isCustom(turn!.choices[0])) left -= 1;
    }
  });

  it("'mixed' deals easy, ours, hard; 'easy' deals two easy and ours", () => {
    const mixed = deals(lobby(WORDS).room, 1)[0]!;
    expect(mixed.choices.map((c) => (isCustom(c) ? 'ours' : c.difficulty))).toEqual([1, 'ours', 3]);
    const easy = deals(lobby(WORDS, { difficulty: 'easy' }).room, 1)[0]!;
    expect(easy.choices.map((c) => (isCustom(c) ? 'ours' : c.difficulty))).toEqual([1, 1, 'ours']);
  });

  it('deals them whatever the words, spicy and difficulty settings', () => {
    for (const settings of [
      { words: 'en' },
      { words: 'taglish' },
      { spicy: true },
      { difficulty: 'easy' },
    ] as const) {
      const turn = deals(lobby(WORDS, settings).room, 1)[0]!;
      expect(turn.choices.filter(isCustom), JSON.stringify(settings)).toHaveLength(1);
    }
  });

  it('custom words alone are enough to start a game', () => {
    const { room } = lobby(['lola', 'lolo', 'tita'], {}, makeRoom({ packs: [] }));
    const r = step(room, { type: 'host:start', by: SCREEN_HOST }, T0 + 1000).room;
    expect(r.phase).toBe('CHOOSING');
    expect(r.turn!.choices.every(isCustom)).toBe(true);
    // And two are not.
    const two = lobby(['lola', 'lolo'], {}, makeRoom({ packs: [] })).room;
    expect(reduce(two, { type: 'host:start', by: SCREEN_HOST }, T0 + 1000)).toEqual({
      ok: false,
      error: 'notEnoughWords',
    });
  });

  it('the auto-pick counts the custom word as medium: Easy rooms get the easy word', () => {
    const { room: l } = lobby(WORDS, { difficulty: 'easy' });
    const room = step(l, { type: 'host:start', by: SCREEN_HOST }, T0 + 1000).room;
    const r = step(
      room,
      { type: 'timer', timer: 'chooseUp', turnId: room.turn!.id, epoch: room.timerEpoch },
      T0 + 13_000,
    ).room;
    expect(r.turn!.word).not.toBeNull();
    expect(isCustom(r.turn!.word!)).toBe(false);
  });

  it('a chosen custom word is guessed like any word, with no plural rule', () => {
    const { room: l, pids } = lobby(['Tita Baby']);
    let room = step(l, { type: 'host:start', by: SCREEN_HOST }, T0 + 1000).room;
    const index = room.turn!.choices.findIndex(isCustom) as 0 | 1 | 2;
    room = choose(room, T0 + 1500, index);
    const guesser = pids.find((p) => p !== room.turn!.drawerPid)!;
    const guess = (text: string, at: number) =>
      step(
        room,
        { type: 'player:guess', by: asPlayer(guesser), text, receivedAt: at, oneWayMs: 0 },
        at,
      ).room;
    expect(guess('tita babys', T0 + 3000).turn!.correct).toEqual([]);
    expect(guess('titababy', T0 + 3000).turn!.correct.map((c) => c.pid)).toEqual([guesser]);
  });

  it('a chosen custom word is not dealt again in the next game; the list survives', () => {
    const { room: l } = lobby(['lola']);
    let room = step(l, { type: 'host:start', by: SCREEN_HOST }, T0 + 1000).room;
    const index = room.turn!.choices.findIndex(isCustom) as 0 | 1 | 2;
    room = choose(room, T0 + 1500, index);
    room = step(room, { type: 'host:end', by: SCREEN_HOST }, T0 + 2000).room;
    expect(room.phase).toBe('FINAL');
    room = step(room, { type: 'host:backToLobby', by: SCREEN_HOST }, T0 + 3000).room;
    expect(room.customWords.map((w) => w.word)).toEqual(['lola']);
    room = step(room, { type: 'host:start', by: SCREEN_HOST }, T0 + 4000).room;
    expect(room.turn!.choices.filter(isCustom)).toEqual([]);
  });
});

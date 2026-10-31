import { describe, expect, it } from 'vitest';
import { CHOOSE_MS, REVEAL_MS } from '../shared/constants.js';
import type { Action, Room, RoomSettings, Turn, View, WordEntry } from '../shared/types.js';
import { maskWord, toView, type Viewer } from './views.js';
import { SCREEN_HOST, asPlayer, choose, started, step } from './test/rooms.js';
import { testPack } from './test/packs.js';

// Every secret starts with `qz`, so a substring search of the serialised view finds any of them.
const SECRET: WordEntry = {
  id: 'test/1',
  word: 'qzsecretword',
  alt: ['qzaltone'],
  difficulty: 2,
  lang: 'en',
  gloss: 'qzglossy',
};
const OTHER_A: WordEntry = { ...SECRET, id: 'test/2', word: 'qzchoicetwo', alt: [], gloss: 'qzg2' };
const OTHER_B: WordEntry = { ...SECRET, id: 'test/3', word: 'qzchoicethree', alt: [] };

/** A started room (Ana draws, Ana holds the crown) with the secret word in play. */
function drawing() {
  const { room, pids, at } = started(['Ana', 'Ben', 'Cy']);
  const turn: Turn = { ...room.turn!, word: SECRET, choices: [SECRET, OTHER_A, OTHER_B] };
  const secret: Room = { ...room, turn };
  return { room: secret, pids, at };
}

const json = (view: View) => JSON.stringify(view);

/** Every non-drawer view: both Screens, the guessers, and a guesser holding the crown. */
function nonDrawerViews(room: Room, drawerPid: string, now: number): [string, View][] {
  const guessers = Object.keys(room.players).filter((pid) => pid !== drawerPid);
  const crowned = { ...room, crownPid: guessers[0]! };
  const viewers: [string, Room, Viewer][] = [
    ['screen with token', room, { kind: 'screen', isHost: true }],
    ['screen', room, { kind: 'screen', isHost: false }],
    ...guessers.map((pid): [string, Room, Viewer] => [
      `guesser ${pid}`,
      room,
      { kind: 'player', pid },
    ]),
    ['crown guesser', crowned, { kind: 'player', pid: guessers[0]! }],
  ];
  return viewers.map(([name, r, viewer]) => [name, toView(r, viewer, now)]);
}

describe('word secrecy in DRAWING', () => {
  it('keeps the word, alternates, gloss and choices out of every Screen and guesser view', () => {
    const { room, pids, at } = drawing();
    for (const [name, view] of nonDrawerViews(room, pids[0]!, at + 1000)) {
      expect(json(view), name).not.toContain('qz');
    }
  });

  it('keeps the word from a guesser who already guessed it', () => {
    const { room, pids, at } = drawing();
    const after = step(
      room,
      {
        type: 'player:guess',
        by: asPlayer(pids[1]!),
        text: 'qzsecretword',
        receivedAt: at + 5000,
        oneWayMs: 0,
      },
      at + 5000,
    ).room;
    expect(after.turn!.correct.map((c) => c.pid)).toEqual([pids[1]]);
    const view = toView(after, { kind: 'player', pid: pids[1]! }, at + 6000);
    expect(view.players.find((p) => p.pid === pids[1])!.guessed).toBe(true);
    expect(view.me.turnPoints).toBeGreaterThan(0);
    expect(json(view)).not.toContain('qz');
    for (const [name, v] of nonDrawerViews(after, pids[0]!, at + 6000)) {
      expect(json(v), name).not.toContain('qz');
    }
  });

  it('gives the drawer the word and its gloss, but never the alternates or other choices', () => {
    const { room, pids, at } = drawing();
    const view = toView(room, { kind: 'player', pid: pids[0]! }, at);
    expect(view.secret).toEqual({
      turnId: room.turn!.id,
      choices: null,
      word: { word: 'qzsecretword', gloss: 'qzglossy', difficulty: 2, custom: false },
      chooseTimer: null,
    });
    const text = json(view);
    expect(text).not.toContain('qzaltone');
    expect(text).not.toContain('qzchoice');
  });

  it('shows everyone the blanks: one `_` per letter', () => {
    const { room, at } = drawing();
    const view = toView(room, { kind: 'screen', isHost: false }, at);
    expect(view.turn!.mask).toEqual(Array<string>(12).fill('_'));
    expect(view.turn!.word).toBeNull();
  });
});

describe('the reveal', () => {
  it('shows the word to everyone, still without alternates, gloss or the other choices', () => {
    const { room, pids, at } = drawing();
    const reveal = step(room, { type: 'host:skip', by: SCREEN_HOST }, at + 2000).room;
    expect(reveal.phase).toBe('REVEAL');
    const views: [string, View][] = [
      ...nonDrawerViews(reveal, pids[0]!, at + 2000),
      ['drawer', toView(reveal, { kind: 'player', pid: pids[0]! }, at + 2000)],
    ];
    for (const [name, view] of views) {
      expect(view.turn!.word, name).toBe('qzsecretword');
      expect(view.turn!.mask, name).toBeNull();
      expect(json(view).replaceAll('qzsecretword', ''), name).not.toContain('qz');
    }
  });

  it('shows close guesses on the Screen only from REVEAL on', () => {
    const { room, at } = drawing();
    const close = [{ pid: 'pclose', text: 'qzsecretwor', at }];
    const withClose = { ...room, turn: { ...room.turn!, closeGuesses: close } };
    expect(toView(withClose, { kind: 'screen', isHost: true }, at).almost).toEqual([]);
    const reveal = step(withClose, { type: 'host:skip', by: SCREEN_HOST }, at + 1).room;
    expect(toView(reveal, { kind: 'screen', isHost: true }, at + 1).almost).toEqual([
      { pid: 'pclose', text: 'qzsecretwor' },
    ]);
  });
});

describe('"Almost:" at the reveal (F35)', () => {
  /** The reveal of a turn with these close guesses and wrong guesses (oldest first). */
  function almost(
    close: [string, string][],
    wrong: [string, string][],
    guessFeed: RoomSettings['guessFeed'] = 'all',
  ) {
    const { room, at } = drawing();
    const item = ([pid, text]: [string, string], i: number) => ({ pid, text, at: at + i });
    const turn = { ...room.turn!, closeGuesses: close.map(item), feed: wrong.map(item) };
    const settings = { ...room.settings, guessFeed };
    const before: Room = { ...room, settings, turn };
    const reveal = step(before, { type: 'host:skip', by: SCREEN_HOST }, at + 100).room;
    return toView(reveal, { kind: 'screen', isHost: false }, at + 100);
  }

  it('lists close guesses first, then the most recent wrong ones, up to three', () => {
    const view = almost(
      [['ben', 'qzsecretwor']],
      [
        ['cy', 'payong'],
        ['ben', 'sapatos'],
        ['cy', 'tsinelas'],
      ],
    );
    expect(view.role === 'screen' && view.almost).toEqual([
      { pid: 'ben', text: 'qzsecretwor' },
      { pid: 'cy', text: 'tsinelas' },
      { pid: 'ben', text: 'sapatos' },
    ]);
  });

  it('fills all three from wrong guesses when nobody came close', () => {
    const view = almost(
      [],
      [
        ['cy', 'a'],
        ['cy', 'b'],
        ['cy', 'c'],
        ['cy', 'd'],
      ],
    );
    expect(view.role === 'screen' && view.almost.map((g) => g.text)).toEqual(['d', 'c', 'b']);
  });

  it('lists the same guess once, however it was typed', () => {
    const view = almost(
      [['ben', 'qzsecretwor']],
      [
        ['cy', 'Payong!'],
        ['ben', 'payong'],
        ['cy', 'QZ secret wor'],
      ],
    );
    expect(view.role === 'screen' && view.almost).toEqual([
      { pid: 'ben', text: 'qzsecretwor' },
      { pid: 'ben', text: 'payong' },
    ]);
  });

  it('masks a wrong guess as the feed does: a slur always, profanity under clean', () => {
    const all = almost(
      [],
      [
        ['cy', 'r3tard'],
        ['cy', 'putangina'],
      ],
    );
    expect(all.role === 'screen' && all.almost).toEqual([
      { pid: 'cy', text: 'putangina' },
      { pid: 'cy', text: null },
    ]);
    const clean = almost([], [['cy', 'putangina']], 'clean');
    expect(clean.role === 'screen' && clean.almost).toEqual([{ pid: 'cy', text: null }]);
  });

  it('lists only the close guesses under guessFeed off, masked as under clean', () => {
    const off = almost(
      [
        ['ben', 'qzsecretwor'],
        ['cy', 'qzsecretword putangina'],
      ],
      [['cy', 'payong']],
      'off',
    );
    expect(off.role === 'screen' && off.almost).toEqual([
      { pid: 'ben', text: 'qzsecretwor' },
      { pid: 'cy', text: null },
    ]);
  });

  it('is empty before the reveal, whatever the turn holds', () => {
    const { room, at } = drawing();
    const item = (text: string) => ({ pid: 'cy', text, at });
    const turn = { ...room.turn!, closeGuesses: [item('qzsecretwor')], feed: [item('payong')] };
    for (const phase of ['CHOOSING', 'DRAWING'] as const) {
      const view = toView({ ...room, phase, turn }, { kind: 'screen', isHost: true }, at);
      expect(view.role === 'screen' && view.almost, phase).toEqual([]);
    }
  });

  it('skips a guess of only fillers or punctuation', () => {
    const view = almost(
      [],
      [
        ['cy', 'payong'],
        ['cy', 'ang'],
        ['cy', '?!'],
      ],
    );
    expect(view.role === 'screen' && view.almost.map((g) => g.text)).toEqual(['payong']);
  });

  it('is empty when nobody guessed at all', () => {
    const view = almost([], []);
    expect(view.role === 'screen' && view.almost).toEqual([]);
  });
});

describe('server-only fields', () => {
  it('never sends keys, the token hash, RNG state, the deck, the packs or custom words', () => {
    const { room, pids, at } = drawing();
    const custom: WordEntry = { ...SECRET, id: 'custom/1', word: 'qzcustom' };
    const full = {
      ...room,
      customWords: [custom],
      deck: { remaining: ['qzdeck'], usedIds: ['qzused'] },
      packs: [testPack('qzpack', 'en', 'spicy', [['qzpackword', 2, 'qzpackgloss']])],
      kickedKeyHashes: ['qzkicked'],
    };
    const views: View[] = [
      ...nonDrawerViews(full, pids[0]!, at).map(([, v]) => v),
      toView(full, { kind: 'player', pid: pids[0]! }, at),
    ];
    for (const view of views) {
      const text = json(view);
      for (const field of [
        'keyHash',
        'hostTokenHash',
        'rngState',
        'deck',
        'packs',
        'customWords',
      ]) {
        expect(text).not.toContain(`"${field}`);
      }
      expect(text).not.toContain('key-Ana');
      expect(text).not.toContain('qzcustom');
      expect(text).not.toContain('qzkicked');
      expect(text).not.toContain('qzused');
      expect(text).not.toContain('qzdeck');
      expect(text).not.toContain('qzpack');
    }
    expect(toView(full, { kind: 'screen', isHost: true }, at).host).toEqual({
      code: room.code,
      customWordCount: 1,
    });
  });
});

describe('avatars (F53)', () => {
  it('every chip carries its player’s avatar, on the Screen and on every phone', () => {
    const { room, pids, at } = drawing();
    const avatars = { [pids[0]!]: '🐙', [pids[1]!]: '🚀', [pids[2]!]: '🐙' } as const;
    const players = Object.fromEntries(
      Object.entries(room.players).map(([pid, p]) => [pid, { ...p, avatar: avatars[pid]! }]),
    );
    const withAvatars: Room = { ...room, players };
    const viewers: Viewer[] = [
      { kind: 'screen', isHost: false },
      ...pids.map((pid) => ({ kind: 'player' as const, pid })),
    ];
    for (const viewer of viewers) {
      const view = toView(withAvatars, viewer, at);
      expect(Object.fromEntries(view.players.map((c) => [c.pid, c.avatar]))).toEqual(avatars);
    }
  });
});

describe('scores and ranks', () => {
  it('carries this turn points during a turn and totals only in FINAL', () => {
    const { room, pids, at } = drawing();
    const guessed = step(
      room,
      {
        type: 'player:guess',
        by: asPlayer(pids[1]!),
        text: 'qzsecretword',
        receivedAt: at,
        oneWayMs: 0,
      },
      at,
    ).room;
    const during = toView(guessed, { kind: 'player', pid: pids[1]! }, at);
    expect(during.me).toMatchObject({ turnPoints: 300, score: null, rank: null });
    expect(during.players.every((p) => p.score === null)).toBe(true);

    const final: Room = { ...guessed, phase: 'FINAL' };
    const ben = toView(final, { kind: 'player', pid: pids[1]! }, at);
    expect(ben.me).toMatchObject({ score: 300, rank: { rank: 1, of: 3 } });
    const cy = toView(final, { kind: 'player', pid: pids[2]! }, at);
    expect(cy.me.rank).toEqual({ rank: 2, of: 3 });
    expect(ben.players.find((p) => p.pid === pids[1])!.score).toBe(300);
  });
});

describe('totals and ranks across a game (F20)', () => {
  const NEXT = { type: 'host:next', by: SCREEN_HOST } as const;
  const viewers = (room: Room): Viewer[] => [
    { kind: 'screen', isHost: true },
    { kind: 'screen', isHost: false },
    ...Object.keys(room.players).map((pid): Viewer => ({ kind: 'player', pid })),
  ];
  const noTotals = (room: Room, now: number) => {
    for (const viewer of viewers(room)) {
      const view = toView(room, viewer, now);
      expect(view.players.map((p) => [p.score, p.rank])).toEqual(
        view.players.map(() => [null, null]),
      );
      if (view.role === 'player') expect(view.me).toMatchObject({ score: null, rank: null });
    }
  };

  /** Ana, Ben and Cy play cycle 1 of 2; Ben guesses turn 1. Returns each phase it passed. */
  function cycleOne() {
    const game = started(['Ana', 'Ben', 'Cy']);
    const { pids, at } = game;
    let room = game.room;
    const seen: Room[] = [room];
    const go = (r: Room) => {
      room = r;
      seen.push(r);
    };
    const word = room.turn!.word!.word;
    const guess: Action = {
      type: 'player:guess',
      by: asPlayer(pids[1]!),
      text: word,
      receivedAt: at + 1_000,
      oneWayMs: 0,
    };
    go(step(room, guess, at + 1_000).room);
    for (let i = 0; i < 3; i++) {
      if (room.phase === 'CHOOSING') go(choose(room, at));
      go(step(room, { type: 'host:skip', by: SCREEN_HOST }, at).room);
      go(step(room, NEXT, at).room);
    }
    return { room, pids, at, seen };
  }

  it('no view carries totals or ranks in CHOOSING, DRAWING or REVEAL; this turn’s points do show', () => {
    const { seen, pids, at } = cycleOne();
    const during = seen.filter((r) => r.phase !== 'SCOREBOARD');
    expect(new Set(during.map((r) => r.phase))).toEqual(new Set(['DRAWING', 'REVEAL', 'CHOOSING']));
    for (const r of during) noTotals(r, at);
    const reveal = seen.find((r) => r.phase === 'REVEAL')!;
    expect(toView(reveal, { kind: 'player', pid: pids[1]! }, at).me.turnPoints).toBeGreaterThan(0);
  });

  it('SCOREBOARD and FINAL carry every total, with shared ranks for ties', () => {
    const { room, pids, at } = cycleOne();
    expect(room.phase).toBe('SCOREBOARD');
    const [ana, ben, cy] = pids as [string, string, string];
    // Ana and Ben tie on 300, Cy has 100: ranks 1, 1, 3.
    const scores: Record<string, number> = { [ana]: 300, [ben]: 300, [cy]: 100 };
    const players = Object.fromEntries(
      Object.entries(room.players).map(([pid, p]) => [pid, { ...p, score: scores[pid]! }]),
    );
    for (const phase of ['SCOREBOARD', 'FINAL'] as const) {
      const r: Room = { ...room, phase, players };
      for (const viewer of viewers(r)) {
        const view = toView(r, viewer, at);
        expect(view.players.map((p) => [p.pid, p.score, p.rank])).toEqual([
          [ana, 300, 1],
          [ben, 300, 1],
          [cy, 100, 3],
        ]);
      }
      expect(toView(r, { kind: 'player', pid: ben }, at).me).toMatchObject({
        score: 300,
        rank: { rank: 1, of: 3 },
      });
      expect(toView(r, { kind: 'player', pid: cy }, at).me.rank).toEqual({ rank: 3, of: 3 });
    }
  });

  it('marks no drawer on the scoreboard', () => {
    const { room, at } = cycleOne();
    const view = toView(room, { kind: 'screen', isHost: false }, at);
    expect(view.players.some((p) => p.isDrawer)).toBe(false);
  });

  it('the next cycle hides the totals again', () => {
    const { room, at } = cycleOne();
    const cycle2 = step(room, NEXT, at).room;
    expect(cycle2.phase).toBe('CHOOSING');
    noTotals(cycle2, at);
  });
});

describe('host block', () => {
  it('goes to the Screen with the token and the crown holder only', () => {
    const { room, pids, at } = drawing();
    expect(toView(room, { kind: 'screen', isHost: true }, at).host).not.toBeNull();
    expect(toView(room, { kind: 'screen', isHost: false }, at).host).toBeNull();
    expect(toView(room, { kind: 'player', pid: pids[0]! }, at).host).not.toBeNull();
    expect(toView(room, { kind: 'player', pid: pids[1]! }, at).host).toBeNull();
  });
});

describe('timers', () => {
  it('sends the drawing clock as time left at send time, frozen while paused', () => {
    const { room, at } = drawing();
    const view = toView(room, { kind: 'screen', isHost: false }, at + 10_000);
    expect(view.turn!.timer).toEqual({ remainingMs: 50_000, totalMs: 60_000, running: true });

    const paused: Room = {
      ...room,
      paused: { reasons: ['host'], since: at + 20_000, remainingMs: 40_000, resumeAt: null },
    };
    const later = toView(paused, { kind: 'screen', isHost: false }, at + 30_000);
    expect(later.turn!.timer).toEqual({ remainingMs: 40_000, totalMs: 60_000, running: false });
    expect(later.paused).toEqual({ reasons: ['host'], resumeInMs: null });
  });

  it('has no turn clock in REVEAL', () => {
    const { room, at } = drawing();
    const reveal = step(room, { type: 'host:skip', by: SCREEN_HOST }, at).room;
    expect(toView(reveal, { kind: 'screen', isHost: false }, at + REVEAL_MS / 2).turn!.timer).toBe(
      null,
    );
  });

  it('counts the choosing clock from the deal', () => {
    const { room, at } = drawing();
    const choosing: Room = { ...room, phase: 'CHOOSING', turn: { ...room.turn!, word: null } };
    expect(toView(choosing, { kind: 'screen', isHost: false }, at + 2000).turn!.timer).toEqual({
      remainingMs: CHOOSE_MS - 2000,
      totalMs: CHOOSE_MS,
      running: true,
    });
  });
});

describe('choices', () => {
  it('go to the drawer in CHOOSING and to nobody else', () => {
    const { room, pids, at } = drawing();
    const choosing: Room = { ...room, phase: 'CHOOSING', turn: { ...room.turn!, word: null } };
    const drawer = toView(choosing, { kind: 'player', pid: pids[0]! }, at);
    expect(drawer.secret!.choices!.map((c) => c.word)).toEqual([
      'qzsecretword',
      'qzchoicetwo',
      'qzchoicethree',
    ]);
    expect(json(drawer)).not.toContain('qzaltone');
    for (const [name, view] of nonDrawerViews(choosing, pids[0]!, at)) {
      expect(json(view), name).not.toContain('qz');
    }
  });

  it('go to the upcoming drawer during REVEAL, and the current word stays theirs alone', () => {
    const { room, pids, at } = drawing();
    const reveal = step(room, { type: 'host:skip', by: SCREEN_HOST }, at).room;
    const upcoming = { ...reveal.turn!, id: reveal.turn!.id + 1, drawerPid: pids[1]!, word: null };
    const four: WordEntry = { ...OTHER_B, id: 'test/4', word: 'qzchoicefour' };
    const withUpcoming: Room = {
      ...reveal,
      upcoming: { ...upcoming, choices: [OTHER_A, OTHER_B, four] },
    };
    const next = toView(withUpcoming, { kind: 'player', pid: pids[1]! }, at);
    expect(next.secret!.turnId).toBe(upcoming.id);
    expect(next.secret!.choices!.map((c) => c.word)).toEqual([
      'qzchoicetwo',
      'qzchoicethree',
      'qzchoicefour',
    ]);
    const cy = toView(withUpcoming, { kind: 'player', pid: pids[2]! }, at);
    expect(json(cy)).not.toContain('qzchoice');
    expect(json(toView(withUpcoming, { kind: 'screen', isHost: true }, at))).not.toContain(
      'qzchoice',
    );
  });
});

describe('maskWord', () => {
  it('blanks letters and keeps spaces, hyphens and apostrophes', () => {
    expect(maskWord('bahay kubo', []).join(' ')).toBe('_ _ _ _ _   _ _ _ _');
    expect(maskWord('halo-halo', [])).toEqual(['_', '_', '_', '_', '-', '_', '_', '_', '_']);
    expect(maskWord("rock 'n' roll", []).filter((c) => c !== '_')).toEqual([' ', "'", "'", ' ']);
  });

  it('shows revealed hint letters in place', () => {
    expect(maskWord('mango', [0, 3])).toEqual(['m', '_', '_', 'g', '_']);
  });

  it('counts an accented letter once', () => {
    expect(maskWord('kamóte'.normalize('NFD'), [])).toHaveLength(6);
  });
});

describe('the feed', () => {
  it('shows wrong guesses on the Screen, not to guessers, and nothing when the feed is off', () => {
    const { room, pids, at } = drawing();
    const wrong = step(
      room,
      { type: 'player:guess', by: asPlayer(pids[1]!), text: 'boat', receivedAt: at, oneWayMs: 0 },
      at,
    ).room;
    expect(toView(wrong, { kind: 'screen', isHost: false }, at).feed).toEqual([
      { pid: pids[1], text: 'boat' },
    ]);
    expect(json(toView(wrong, { kind: 'player', pid: pids[2]! }, at))).not.toContain('boat');
    expect(toView(wrong, { kind: 'player', pid: pids[0]! }, at).lastGuess).toEqual({
      pid: pids[1],
      text: 'boat',
    });
    const off: Room = { ...wrong, settings: { ...wrong.settings, guessFeed: 'off' } };
    expect(toView(off, { kind: 'screen', isHost: false }, at).feed).toEqual([]);
  });
});

describe("the drawer's latest guess (F36)", () => {
  const guessAt = (room: Room, pid: string, text: string, at: number) =>
    step(room, { type: 'player:guess', by: asPlayer(pid), text, receivedAt: at, oneWayMs: 0 }, at)
      .room;
  /** Ben then Cy guess wrong, Cy last. */
  function twoWrong() {
    const { room, pids, at } = drawing();
    const one = guessAt(room, pids[1]!, 'boat', at + 1_000);
    return { room: guessAt(one, pids[2]!, 'kite', at + 2_000), pids, at: at + 2_000 };
  }

  it('carries only the latest wrong guess to the drawer', () => {
    const { room, pids, at } = twoWrong();
    expect(toView(room, { kind: 'player', pid: pids[0]! }, at).lastGuess).toEqual({
      pid: pids[2],
      text: 'kite',
    });
  });

  it("never reaches a guesser's view, nor one who already got the word", () => {
    const { room, pids, at } = twoWrong();
    const right = guessAt(room, pids[1]!, SECRET.word, at + 1_000);
    expect(right.turn!.correct.map((c) => c.pid)).toEqual([pids[1]]);
    for (const pid of [pids[1]!, pids[2]!]) {
      const view = toView(right, { kind: 'player', pid }, at + 1_000);
      expect(view.lastGuess).toBeNull();
      expect(json(view)).not.toContain('kite');
      expect(json(view)).not.toContain('boat');
    }
  });

  it('is masked as the feed is: a slur always, profanity under clean, as clean under off', () => {
    const { room, pids, at } = drawing();
    const rude = guessAt(room, pids[1]!, 'putangina', at + 1_000);
    const slur = guessAt(room, pids[1]!, 'r3tard', at + 1_000);
    const drawerView = (r: Room, mode: RoomSettings['guessFeed']) =>
      toView(
        { ...r, settings: { ...r.settings, guessFeed: mode } },
        { kind: 'player', pid: pids[0]! },
        at + 1_000,
      ).lastGuess;
    expect(drawerView(rude, 'all')).toEqual({ pid: pids[1], text: 'putangina' });
    expect(drawerView(rude, 'clean')).toEqual({ pid: pids[1], text: null });
    expect(drawerView(rude, 'off')).toEqual({ pid: pids[1], text: null });
    expect(drawerView(slur, 'all')).toEqual({ pid: pids[1], text: null });
  });

  it('skips close guesses (the drawer hears those as an alert) and is gone after DRAWING', () => {
    const { room, pids, at } = twoWrong();
    const close = guessAt(room, pids[1]!, `${SECRET.word} ko`, at + 1_000);
    expect(close.turn!.closeGuesses).toHaveLength(1);
    expect(json(toView(close, { kind: 'screen', isHost: true }, at + 1_000))).not.toContain(' ko');
    expect(toView(close, { kind: 'player', pid: pids[0]! }, at + 1_000).lastGuess).toEqual({
      pid: pids[2],
      text: 'kite',
    });
    const reveal: Room = { ...close, phase: 'REVEAL', turn: { ...close.turn!, endReason: 'time' } };
    expect(toView(reveal, { kind: 'player', pid: pids[0]! }, at + 1_000).lastGuess).toBeNull();
  });
});

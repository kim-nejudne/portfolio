import { describe, expect, it } from 'vitest';
import { CHOOSE_MS, REVEAL_MS } from '../shared/constants.js';
import type { Room, Turn, View, WordEntry } from '../shared/types.js';
import { maskWord, toView, type Viewer } from './views.js';
import { SCREEN_HOST, asPlayer, started, step } from './test/rooms.js';

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
      word: { word: 'qzsecretword', gloss: 'qzglossy', difficulty: 2 },
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
    expect(toView(withClose, { kind: 'screen', isHost: true }, at).closeGuesses).toEqual([]);
    const reveal = step(withClose, { type: 'host:skip', by: SCREEN_HOST }, at + 1).room;
    expect(toView(reveal, { kind: 'screen', isHost: true }, at + 1).closeGuesses).toEqual([
      { pid: 'pclose', text: 'qzsecretwor' },
    ]);
  });
});

describe('server-only fields', () => {
  it('never sends keys, the token hash, RNG state, the deck or custom words', () => {
    const { room, pids, at } = drawing();
    const custom: WordEntry = { ...SECRET, id: 'custom/1', word: 'qzcustom' };
    const full = {
      ...room,
      customWords: [custom],
      deck: { remaining: [custom], usedIds: ['qzused'] },
      kickedKeyHashes: ['qzkicked'],
    };
    const views: View[] = [
      ...nonDrawerViews(full, pids[0]!, at).map(([, v]) => v),
      toView(full, { kind: 'player', pid: pids[0]! }, at),
    ];
    for (const view of views) {
      const text = json(view);
      for (const field of ['keyHash', 'hostTokenHash', 'rngState', 'deck', 'customWords']) {
        expect(text).not.toContain(`"${field}`);
      }
      expect(text).not.toContain('key-Ana');
      expect(text).not.toContain('qzcustom');
      expect(text).not.toContain('qzkicked');
      expect(text).not.toContain('qzused');
    }
    expect(toView(full, { kind: 'screen', isHost: true }, at).host).toEqual({
      code: room.code,
      customWordCount: 1,
    });
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

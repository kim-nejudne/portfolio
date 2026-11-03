// The current word's category in every view (F79; Role views): from the choice through REVEAL,
// for every role, as `{title, emoji}` or "Custom". Never before the choice, never an unchosen
// choice's or the `upcoming` deal's, and never with the word, an alternate or an id.
import { describe, expect, it } from 'vitest';
import type { Room, View, WordEntry } from '../shared/types.js';
import type { Category } from './categoryStore.js';
import { buildSnapshot } from './snapshot.js';
import { toView, type Viewer } from './views.js';
import { SCREEN_HOST, T0, asPlayer, choose, inPhase, step, withPlayers } from './test/rooms.js';

const category = (id: string, title: string, emoji: string, words: string[]): Category => ({
  id,
  title,
  emoji,
  defaultOn: true,
  hidden: false,
  words: words.map((word, i) => ({ id: `w${i}`, word, alt: [`${word}alt`], difficulty: 1 })),
});

// Titles and emoji found nowhere else in a view, so a search of the JSON finds any of them.
const ALPHA = category('cat-alpha', 'Alphathings', '🅰️', ['apple', 'anchor', 'arrow', 'acorn']);
const BETA = category('cat-beta', 'Betathings', '🅱️', ['button', 'bucket', 'barrel', 'bridge']);
const GAMMA = category('cat-gamma', 'Gammathings', '🌀', ['goblet', 'garden', 'guitar', 'glove']);
const SNAPSHOT = buildSnapshot([ALPHA, BETA, GAMMA], [ALPHA.id, BETA.id, GAMMA.id]);
const MARKERS = [ALPHA, BETA, GAMMA].flatMap((c) => [c.title, c.emoji, c.id]);

const firstOf = (c: Category): WordEntry => SNAPSHOT.words.find((w) => w.categoryId === c.id)!;
const CUSTOM: WordEntry = {
  id: 'custom/grandma',
  word: 'grandma',
  alt: [],
  difficulty: 2,
  lang: 'custom',
  categoryId: null,
};

/** Ana draws, choosing among one word from each category, in CHOOSING at `at`. */
function choosing(
  choices: [WordEntry, WordEntry, WordEntry] = [firstOf(ALPHA), firstOf(BETA), firstOf(GAMMA)],
) {
  const joined = withPlayers(['Ana', 'Ben', 'Cy']);
  const at = T0 + 1000;
  const started = step(
    joined.room,
    { type: 'host:start', by: SCREEN_HOST, snapshot: SNAPSHOT },
    at,
  ).room;
  const room: Room = { ...started, turn: { ...started.turn!, choices } };
  return { room, pids: joined.pids, at };
}

/** Every role: both Screens, the drawer, the guessers, and a guesser holding the crown. */
function views(room: Room, now: number): [string, View][] {
  const pids = Object.keys(room.players);
  const guesser = pids.find((pid) => pid !== room.turn?.drawerPid)!;
  const crowned = { ...room, crownPid: guesser };
  const viewers: [string, Room, Viewer][] = [
    ['screen with token', room, { kind: 'screen', isHost: true }],
    ['screen', room, { kind: 'screen', isHost: false }],
    ...pids.map((pid): [string, Room, Viewer] => [`player ${pid}`, room, { kind: 'player', pid }]),
    ['crown guesser', crowned, { kind: 'player', pid: guesser }],
  ];
  return viewers.map(([name, r, viewer]) => [name, toView(r, viewer, now)]);
}

const markersIn = (view: View) => MARKERS.filter((m) => JSON.stringify(view).includes(m));

describe('the turn’s category in the views', () => {
  it('is in no view, and no category is, while the drawer is choosing', () => {
    const { room, at } = choosing();
    expect(room.phase).toBe('CHOOSING');
    for (const [name, view] of views(room, at + 500)) {
      expect(view.turn!.category, name).toBeNull();
      expect(markersIn(view), name).toEqual([]);
    }
  });

  it('is the chosen word’s title and emoji for every role in DRAWING, and only that one', () => {
    const { room: dealt, at } = choosing();
    const room = choose(dealt, at + 500, 1);
    expect(room.phase).toBe('DRAWING');
    for (const [name, view] of views(room, at + 1000)) {
      expect(view.turn!.category, name).toEqual({
        kind: 'category',
        title: 'Betathings',
        emoji: '🅱️',
      });
      expect(markersIn(view), name).toEqual(['Betathings', '🅱️']);
    }
  });

  it('carries no word, alternate or id', () => {
    const { room: dealt, at } = choosing();
    const room = choose(dealt, at + 500, 1);
    const view = toView(room, { kind: 'screen', isHost: true }, at + 1000);
    const json = JSON.stringify(view.turn!.category);
    expect(Object.keys(view.turn!.category!).sort()).toEqual(['emoji', 'kind', 'title']);
    for (const secret of ['button', 'buttonalt', 'cat-beta', 'w0'])
      expect(json).not.toContain(secret);
  });

  it('stays with a guesser who already guessed right, still without the word', () => {
    const { room: dealt, pids, at } = choosing();
    const drawing = choose(dealt, at + 500, 1);
    const guessed = step(
      drawing,
      {
        type: 'player:guess',
        by: asPlayer(pids[1]!),
        text: 'button',
        receivedAt: at + 3000,
        oneWayMs: 0,
      },
      at + 3000,
    ).room;
    expect(guessed.turn!.correct.map((c) => c.pid)).toEqual([pids[1]]);
    const view = toView(guessed, { kind: 'player', pid: pids[1]! }, at + 3500);
    expect(view.turn!.category).toEqual({ kind: 'category', title: 'Betathings', emoji: '🅱️' });
    expect(JSON.stringify(view)).not.toContain('button');
  });

  it('stays through REVEAL, and is never the upcoming deal’s', () => {
    const { room: dealt, at } = choosing();
    const drawing = choose(dealt, at + 500, 1);
    const reveal = step(drawing, { type: 'host:skip', by: SCREEN_HOST }, at + 2000).room;
    expect(reveal.phase).toBe('REVEAL');
    // The next drawer's choices from the other categories, so their categories would show.
    const room: Room = {
      ...reveal,
      upcoming: { ...reveal.upcoming!, choices: [firstOf(ALPHA), firstOf(GAMMA), firstOf(ALPHA)] },
    };
    expect(room.upcoming!.drawerPid).not.toBe(room.turn!.drawerPid);
    for (const [name, view] of views(room, at + 2500)) {
      expect(view.turn!.category, name).toEqual({
        kind: 'category',
        title: 'Betathings',
        emoji: '🅱️',
      });
      expect(markersIn(view), name).toEqual(['Betathings', '🅱️']);
    }
  });

  it('is gone once the turn is taken up by the next drawer', () => {
    const { room: dealt, at } = choosing();
    const drawing = choose(dealt, at + 500, 1);
    const reveal = step(drawing, { type: 'host:skip', by: SCREEN_HOST }, at + 2000).room;
    const next = step(reveal, { type: 'host:next', by: SCREEN_HOST }, at + 3000).room;
    expect(next.phase).toBe('CHOOSING');
    for (const [name, view] of views(next, at + 3500)) {
      expect(view.turn!.category, name).toBeNull();
    }
  });

  it('is not in the SCOREBOARD or FINAL views, though the ended turn’s word is', () => {
    for (const phase of ['SCOREBOARD', 'FINAL'] as const) {
      const room = inPhase(phase);
      expect(room.turn?.word, phase).toBeTruthy();
      for (const [name, view] of views(room, T0 + 600_000)) {
        expect(view.turn?.category ?? null, `${phase} ${name}`).toBeNull();
      }
    }
  });

  it('is "Custom" for one of the room’s own words', () => {
    const { room: dealt, at } = choosing([CUSTOM, firstOf(ALPHA), firstOf(BETA)]);
    const room = choose(dealt, at + 500, 0);
    for (const [name, view] of views(room, at + 1000)) {
      expect(view.turn!.category, name).toEqual({ kind: 'custom' });
      expect(markersIn(view), name).toEqual([]);
    }
  });

  it('is none for a word whose category is not in the snapshot', () => {
    const { room: dealt, at } = choosing();
    const room = choose(dealt, at + 500, 1);
    const lost: Room = { ...room, snapshot: { ...SNAPSHOT, categories: [] } };
    expect(toView(lost, { kind: 'screen', isHost: false }, at + 1000).turn!.category).toBeNull();
  });
});

// Word secrecy leak tests (Test plan: Secrecy). A scripted game visits every phase and, at every
// step, serialises every view (both Screens, every player, the crown holder) and every effect.
// No word, alternate, gloss or choice may reach anyone but its drawer before REVEAL, a correct
// guesser and the crown holder included. A second game runs the same check end to end through the
// socket gateway: every `state`, `fx` and ack a socket receives, and every console line.
//
// Every secret in play carries a `qz` marker (every room here deals from `LEAK_PACK`), so a token
// search of the JSON finds any of them, wherever it hides. Every secret must therefore come from
// `LEAK_PACK` or `CLOSE_TEXT`. Logs are checked through `console.*`, the server's only logger; a
// logger added later must be spied on here too.

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GRACE_MS, GUESS_INTERVAL_MS } from '../shared/constants.js';
import type {
  Effect,
  Phase,
  Room,
  ScreenView,
  Turn,
  View,
  WordEntry,
  WordPack,
} from '../shared/types.js';
import { hintCount } from './hints.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import { reduce } from './reducer.js';
import { createRoom } from './room.js';
import { InMemoryRoomStore } from './roomStore.js';
import { attachSockets } from './sockets.js';
import {
  SCREEN_HOST,
  asPlayer,
  choose,
  makeRoom,
  secretWord,
  step,
  withPlayers,
} from './test/rooms.js';
import { toView, type Viewer } from './views.js';

const LEAK_PACK: WordPack = {
  id: 'leak',
  title: 'Leak',
  language: 'tl',
  rating: 'family',
  words: Array.from({ length: 30 }, (_, i) => ({
    id: `leak/${i}`,
    word: `qzw${i}`,
    alt: [`qza${i}`, `qzb${i}`],
    difficulty: ((i % 3) + 1) as 1 | 2 | 3,
    lang: 'tl' as const,
    gloss: `qzg${i}`,
  })),
};
const leakRoom = (settings: Partial<Room['settings']> = {}) => {
  const room = makeRoom({ packs: [LEAK_PACK] });
  return { ...room, settings: { ...room.settings, ...settings } };
};

const ALL_PHASES: Phase[] = ['LOBBY', 'CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD', 'FINAL'];
/** A close guess's text (a near miss of the word): Screen only, and only from REVEAL on. */
const CLOSE_TEXT = 'qzclose';

const tokens = (value: unknown): string[] => JSON.stringify(value).match(/qz[a-z0-9]+/g) ?? [];

const entrySecrets = (e: WordEntry): string[] => [e.word, ...(e.gloss ? [e.gloss] : [])];
/** What a drawer may see of their own turn: the choices until one is chosen, then only the
 * chosen word; glosses included, alternates never. */
const drawerSecrets = (turn: Turn): string[] =>
  (turn.word ? [turn.word] : turn.choices).flatMap(entrySecrets);

const revealPhase = (phase: Phase) =>
  phase === 'REVEAL' || phase === 'SCOREBOARD' || phase === 'FINAL';

/** Words anyone may see: the current word once its turn has ended, every past word in FINAL. */
function publicWords(room: Room): string[] {
  const words: string[] = [];
  if (revealPhase(room.phase) && room.turn?.word && room.turn.endReason !== null)
    words.push(room.turn.word.word);
  if (room.phase === 'FINAL') words.push(...room.history.map((h) => h.word));
  return words;
}

type Audience = { kind: 'screen' } | { kind: 'player'; pid: string } | { kind: 'all' };

/** Every `qz` token this audience may receive in `room`. Alternates are never on the list. */
function allowedFor(room: Room, who: Audience): Set<string> {
  const allowed = new Set(publicWords(room));
  const { phase, turn, upcoming } = room;
  if (who.kind === 'player') {
    if ((phase === 'CHOOSING' || phase === 'DRAWING') && turn?.drawerPid === who.pid)
      for (const s of drawerSecrets(turn)) allowed.add(s);
    if ((phase === 'REVEAL' || phase === 'SCOREBOARD') && upcoming?.drawerPid === who.pid)
      for (const s of drawerSecrets(upcoming)) allowed.add(s);
  }
  if (who.kind === 'screen' && revealPhase(phase)) allowed.add(CLOSE_TEXT);
  return allowed;
}

function expectNoLeak(value: unknown, allowed: Set<string>, label: string): void {
  const leaked = tokens(value).filter((t) => !allowed.has(t));
  expect(leaked, label).toEqual([]);
}

const VIEWERS = (room: Room): [string, Viewer, Audience][] => [
  ['screen with token', { kind: 'screen', isHost: true }, { kind: 'screen' }],
  ['screen', { kind: 'screen', isHost: false }, { kind: 'screen' }],
  ...Object.values(room.players).map((p): [string, Viewer, Audience] => {
    const roles = [
      room.turn?.drawerPid === p.pid ? 'drawer' : 'guesser',
      ...(room.crownPid === p.pid ? ['crown'] : []),
      ...(room.turn?.correct.some((c) => c.pid === p.pid) ? ['guessed'] : []),
    ];
    return [
      `${p.name} (${roles.join(', ')})`,
      { kind: 'player', pid: p.pid },
      { kind: 'player', pid: p.pid },
    ];
  }),
];

const audienceOf = (effect: Effect): Audience | null => {
  if (effect.type !== 'fx') return null;
  if (effect.to === 'screen') return { kind: 'screen' };
  if (effect.to === 'all') return { kind: 'all' };
  return { kind: 'player', pid: effect.to.pid };
};

/** The views of everyone in `room` at `now`, checked; and `effects`, checked per recipient. */
function audit(label: string, room: Room, now: number, effects: Effect[] = []): View[] {
  const views: View[] = [];
  for (const [name, viewer, who] of VIEWERS(room)) {
    const view = toView(room, viewer, now);
    expectNoLeak(view, allowedFor(room, who), `${label}: ${name}`);
    views.push(view);
  }
  for (const effect of effects) {
    // Internal effects (timers, ink open/close) reach nobody, but may be logged: public only.
    const who = audienceOf(effect) ?? { kind: 'all' };
    expectNoLeak(effect, allowedFor(room, who), `${label}: effect ${effect.type}`);
  }
  visited.add(room.phase);
  return views;
}

let visited = new Set<Phase>();

const screenView = (room: Room, now: number) => toView(room, { kind: 'screen', isHost: true }, now);
const playerView = (room: Room, pid: string, now: number) =>
  toView(room, { kind: 'player', pid }, now);

/** The word in play: tests only, to make right guesses and positive checks. */
const word = (room: Room) => secretWord(room);

describe('word secrecy across a scripted game', () => {
  it('no Screen, guesser or crown view gets a word, alternate, gloss or choice before REVEAL', () => {
    visited = new Set();
    let t = 1_000_000;
    const players = withPlayers(['Ana', 'Ben', 'Cy'], leakRoom());
    let room = players.room;
    const [ana, ben, cy] = players.pids as [string, string, string];
    const act = (label: string, action: Parameters<typeof step>[1], dt = 1000) => {
      t += dt;
      const res = step(room, action, t);
      room = res.room;
      audit(label, room, t, res.effects);
    };

    // LOBBY: Ana holds the crown.
    audit('lobby', room, t);
    expect(room.crownPid).toBe(ana);

    // Turn 1: Ana is dealt three words and holds the crown.
    act('turn 1 dealt', { type: 'host:start', by: SCREEN_HOST });
    expect(room.phase).toBe('CHOOSING');
    expect(room.turn!.drawerPid).toBe(ana);
    // Positive control: the drawer does get all three choices and their glosses.
    expect(tokens(playerView(room, ana, t))).toEqual(
      expect.arrayContaining(room.turn!.choices.flatMap(entrySecrets)),
    );
    act('turn 1 starts', { type: 'drawer:choose', by: asPlayer(ana, true), index: 2 });
    expect(room.phase).toBe('DRAWING');
    const first = word(room);
    // Positive control: the drawer keeps the word and its gloss, and loses the other two.
    expect(tokens(playerView(room, ana, t))).toEqual(
      expect.arrayContaining([first, room.turn!.word!.gloss]),
    );
    expect(tokens(playerView(room, ana, t))).not.toContain(room.turn!.choices[0].word);

    act('wrong guess', {
      type: 'player:guess',
      by: asPlayer(ben),
      text: 'payong',
      receivedAt: t + 1000,
      oneWayMs: 0,
    });
    // F19: a hint letter goes into every view's mask, never the word.
    act('hint', { type: 'timer', timer: 'hint', turnId: room.turn!.id, epoch: room.timerEpoch });
    expect(room.turn!.hintIndexes).toHaveLength(hintCount(first) > 0 ? 1 : 0);
    // Positive control: the Screen's and a guesser's mask show exactly the hinted letter.
    for (const view of [screenView(room, t), playerView(room, cy, t)]) {
      const shown = view.turn!.mask!.flatMap((ch, i) => (ch === '_' ? [] : [i]));
      expect(shown).toEqual(room.turn!.hintIndexes);
    }
    act('right guess', {
      type: 'player:guess',
      by: asPlayer(ben),
      text: first,
      receivedAt: t + 1000,
      oneWayMs: 0,
    });
    expect(room.turn!.correct.map((c) => c.pid)).toEqual([ben]);
    expect(playerView(room, ben, t).me.turnPoints).toBeGreaterThan(0);

    // A late joiner arrives mid-turn.
    act('late join', {
      type: 'player:join',
      by: { kind: 'player', isHost: false },
      keyHash: 'key-Dee',
      name: 'Dee',
      avatar: '🦊',
    });
    const dee = Object.values(room.players).find((p) => p.name === 'Dee')!.pid;

    // A host pause, the 3-2-1, and drawing again (F28).
    act('paused', { type: 'host:pause', by: SCREEN_HOST });
    act('resuming', { type: 'host:resume', by: asPlayer(ana, true) });
    act(
      'resumed',
      { type: 'timer', timer: 'resumeGo', turnId: room.turn!.id, epoch: room.timerEpoch },
      3000,
    );
    expect(room.paused).toBeNull();

    // synth close guess. TODO(F15): a real near-miss guess instead.
    // kept from the Screen until REVEAL, never sent to a phone.
    room = {
      ...room,
      turn: { ...room.turn!, closeGuesses: [{ pid: cy, text: CLOSE_TEXT, at: t }] },
    };
    audit('close guess', room, t);

    // Time runs out: REVEAL.
    act(
      'reveal 1',
      {
        type: 'timer',
        timer: 'drawUp',
        turnId: room.turn!.id,
        epoch: room.timerEpoch,
      },
      room.turn!.endsAt! + GRACE_MS - t,
    );
    expect(room.phase).toBe('REVEAL');
    expect(screenView(room, t).turn!.word).toBe(first);
    // "Almost:": the close guess, then the wrong one (F35).
    expect(screenView(room, t).almost).toEqual([
      { pid: cy, text: CLOSE_TEXT },
      { pid: ben, text: 'payong' },
    ]);

    // F21: Ben, next to draw, was dealt on entering REVEAL. Positive control: his phone has the
    // three choices and their glosses; every other view was audited above.
    expect(room.upcoming!.drawerPid).toBe(ben);
    expect(tokens(playerView(room, ben, t))).toEqual(
      expect.arrayContaining(room.upcoming!.choices.flatMap(entrySecrets)),
    );

    // Turn 2: Ben doesn't choose during the reveal, so CHOOSING, then the auto-pick; Ana, still
    // crowned, guesses right.
    act('turn 2 taken up unchosen', { type: 'host:next', by: SCREEN_HOST });
    expect(room.phase).toBe('CHOOSING');
    expect(room.turn!.drawerPid).toBe(ben);
    act(
      'turn 2 auto-pick',
      { type: 'timer', timer: 'chooseUp', turnId: room.turn!.id, epoch: room.timerEpoch },
      12_000,
    );
    expect(room.phase).toBe('DRAWING');
    expect(room.crownPid).toBe(ana);
    act('crown guesses right', {
      type: 'player:guess',
      by: asPlayer(ana, true),
      text: word(room),
      receivedAt: t,
      oneWayMs: 0,
    });
    act('late joiner guesses wrong', {
      type: 'player:guess',
      by: asPlayer(dee),
      text: 'bahay',
      receivedAt: t,
      oneWayMs: 0,
    });

    // Ana leaves: the crown passes to Ben (the drawer now, a guesser next turn).
    act('crown leaves', { type: 'player:leave', by: asPlayer(ana, true) });
    expect(room.crownPid).toBe(ben);
    act('reveal 2', { type: 'host:skip', by: SCREEN_HOST });

    // Turn 3: Cy chooses during the reveal and draws at once; Ben guesses right with the crown.
    expect(room.upcoming!.drawerPid).toBe(cy);
    act('turn 3 chosen during the reveal', { type: 'drawer:choose', by: asPlayer(cy), index: 0 });
    expect(room.phase).toBe('REVEAL');
    act('turn 3 starts', { type: 'host:next', by: SCREEN_HOST });
    expect(room.phase).toBe('DRAWING');
    expect(room.turn!.drawerPid).toBe(cy);
    act('crown guesses right', {
      type: 'player:guess',
      by: asPlayer(ben, true),
      text: word(room),
      receivedAt: t,
      oneWayMs: 0,
    });
    act('reveal 3', { type: 'host:skip', by: SCREEN_HOST });

    // Turn 4 (F23): Dee joined while turns remained, so they were appended to cycle 1. Dealt at
    // the reveal, they choose in CHOOSING; Ben guesses right with the crown.
    expect(room.upcoming!.drawerPid).toBe(dee);
    act('late joiner taken up unchosen', { type: 'host:next', by: SCREEN_HOST });
    expect([room.phase, room.turn!.drawerPid, room.cycle]).toEqual(['CHOOSING', dee, 1]);
    act('late joiner draws in cycle 1', { type: 'drawer:choose', by: asPlayer(dee), index: 0 });
    act('crown guesses right', {
      type: 'player:guess',
      by: asPlayer(ben, true),
      text: word(room),
      receivedAt: t,
      oneWayMs: 0,
    });
    act('reveal 4', { type: 'host:skip', by: SCREEN_HOST });

    // Cycle 1 is done: the totals and ranks, then cycle 2 in join order, the late joiner included.
    // Ben was dealt cycle 2's first turn at the reveal, and chooses on the scoreboard.
    act('scoreboard', { type: 'host:next', by: SCREEN_HOST });
    expect(room.phase).toBe('SCOREBOARD');
    expect(room.turnOrder).toEqual([ben, cy, dee]);
    expect(room.upcoming).toMatchObject({ drawerPid: ben, cycle: 2 });
    act('cycle 2 chosen on the scoreboard', {
      type: 'drawer:choose',
      by: asPlayer(ben, true),
      index: 1,
    });
    expect(room.phase).toBe('SCOREBOARD');
    act('cycle 2 starts', { type: 'host:next', by: SCREEN_HOST });
    expect(room.turn!.drawerPid).toBe(ben);
    act('cycle 2, Ben skipped', { type: 'host:skip', by: SCREEN_HOST });
    act('cycle 2, Cy taken up', { type: 'host:next', by: SCREEN_HOST });
    act('cycle 2, Cy skipped', { type: 'host:skip', by: SCREEN_HOST });
    expect(room.turn!.drawerPid).toBe(dee);
    act('late joiner draws', { type: 'drawer:choose', by: asPlayer(dee), index: 1 });
    // F25: the token Screen crowns Cy, a guesser still without the word, who passes it back.
    act('Screen crowns a guesser mid-turn', { type: 'host:crown', by: SCREEN_HOST, pid: cy });
    expect(room.crownPid).toBe(cy);
    act('crowned guesser passes the crown', {
      type: 'host:crown',
      by: asPlayer(cy, true),
      pid: ben,
    });
    expect(room.crownPid).toBe(ben);
    // And to the drawer mid-DRAWING, whose view then has both the host block and the word.
    act('Screen crowns the drawer mid-turn', { type: 'host:crown', by: SCREEN_HOST, pid: dee });
    expect(room.crownPid).toBe(dee);
    act('crowned drawer passes the crown', {
      type: 'host:crown',
      by: asPlayer(dee, true),
      pid: ben,
    });
    act('crown guesses right', {
      type: 'player:guess',
      by: asPlayer(ben, true),
      text: word(room),
      receivedAt: t,
      oneWayMs: 0,
    });
    act('reveal 5', { type: 'host:skip', by: SCREEN_HOST });

    // The last cycle is done, so the game ends.
    act('final', { type: 'host:next', by: SCREEN_HOST });
    expect(room.phase).toBe('FINAL');
    expect(screenView(room, t).gallery.map((g) => g.word)).toEqual(room.history.map((h) => h.word));

    // F29: a rematch. The countdown names the next first drawer (Ben, who joined after Ana), and
    // game 2's deal and drawing are audited like game 1's.
    act('rematch countdown', { type: 'host:rematch', by: SCREEN_HOST });
    expect(screenView(room, t).rematchFirst).toMatchObject({ pid: ben });
    act(
      'game 2 dealt',
      { type: 'timer', timer: 'rematchGo', turnId: room.turn!.id, epoch: room.timerEpoch },
      3000,
    );
    expect([room.phase, room.turn!.drawerPid, room.session.gameNumber]).toEqual([
      'CHOOSING',
      ben,
      2,
    ]);
    act('game 2 drawing', { type: 'drawer:choose', by: asPlayer(ben, true), index: 0 });
    act('game 2 guess', {
      type: 'player:guess',
      by: asPlayer(cy),
      text: word(room),
      receivedAt: t,
      oneWayMs: 0,
    });
    act('game 2 reveal', { type: 'host:skip', by: SCREEN_HOST });
    act('game 2 ended', { type: 'host:end', by: SCREEN_HOST });
    expect(
      screenView(room, t)
        .tonight!.map((r) => r.pid)
        .sort(),
    ).toEqual(Object.keys(room.players).sort());

    expect([...visited].sort()).toEqual([...ALL_PHASES].sort());
  });

  it('never sends alternates, even to the drawer, at the reveal or in FINAL', () => {
    let { room } = withPlayers(['Ana', 'Ben'], leakRoom({ cycles: 1 }));
    let t = 2_000_000;
    room = step(room, { type: 'host:start', by: SCREEN_HOST }, t).room;
    expect(room.turn!.choices.every((c) => c.alt.length > 0)).toBe(true);
    for (const action of [
      'choose',
      'host:skip',
      'host:next',
      'choose',
      'host:skip',
      'host:next',
    ] as const) {
      t += 1000;
      room =
        action === 'choose'
          ? choose(room, t, 1)
          : step(room, { type: action, by: SCREEN_HOST }, t).room;
      for (const [name, viewer] of VIEWERS(room)) {
        const found = tokens(toView(room, viewer, t)).filter((tok) => /^qz[ab]\d/.test(tok));
        expect(found, `${room.phase}: ${name}`).toEqual([]);
      }
    }
    expect(room.phase).toBe('FINAL');
  });
});

// The last drawer's choice skipped: FINAL keeps the unchosen turn in state, never in a view.
it('keeps an abandoned deal out of every view, through to FINAL', () => {
  const { room: lobby } = withPlayers(['Ana', 'Ben'], leakRoom({ cycles: 1 }));
  let t = 3_000_000;
  let res = step(lobby, { type: 'host:start', by: SCREEN_HOST }, t);
  audit('dealt', res.room, t, res.effects);
  for (const label of ['skip 1', 'skip 2']) {
    t += 1000;
    res = step(res.room, { type: 'host:skip', by: SCREEN_HOST }, t);
    audit(label, res.room, t, res.effects);
  }
  expect(res.room.phase).toBe('FINAL');
  expect(res.room.turn!.word).toBeNull();
});

// F48: custom words reach their drawer as a choice, and anyone else only as a count, never a word.
it('keeps custom words out of every view and effect but their drawer’s, through to FINAL', () => {
  const { room: lobby } = withPlayers(['Ana', 'Ben', 'Cy'], leakRoom({ cycles: 1 }));
  let t = 3_500_000;
  let room = lobby;
  const act = (label: string, action: Parameters<typeof step>[1]) => {
    t += 1000;
    const res = step(room, action, t);
    room = res.room;
    audit(label, room, t, res.effects);
  };
  act('custom words added', {
    type: 'host:customWords',
    by: SCREEN_HOST,
    words: ['qzcustomone', 'qzcustomtwo', 'qzcustomthree', 'qzcustomfour'],
  });
  expect(toView(room, { kind: 'screen', isHost: true }, t).host?.customWordCount).toBe(4);
  act('dealt', { type: 'host:start', by: SCREEN_HOST });
  for (let turn = 1; room.phase !== 'FINAL'; turn++) {
    expect(room.turn!.choices.filter((c) => c.lang === 'custom')).toHaveLength(1);
    const ours = room.turn!.choices.findIndex((c) => c.lang === 'custom') as 0 | 1 | 2;
    act(`turn ${turn} chosen`, {
      type: 'drawer:choose',
      by: asPlayer(room.turn!.drawerPid),
      index: ours,
    });
    act(`turn ${turn} skipped`, { type: 'host:skip', by: SCREEN_HOST });
    while (room.phase === 'REVEAL' || room.phase === 'SCOREBOARD')
      act(`turn ${turn} next`, { type: 'host:next', by: SCREEN_HOST });
  }
  expect(room.history.map((h) => h.word)).toEqual(
    expect.arrayContaining([expect.stringMatching(/^qzcustom/)]),
  );
});

// F28: a kicked drawer, a pause across a skip, and the game ended with a word chosen for the next
// turn. The kicked drawer's turn is revealed; the discarded `upcoming` word never is.
it('keeps the words secret through kick, pause, skip and end', () => {
  const { room: lobby, pids } = withPlayers(['Ana', 'Ben', 'Cy', 'Dee'], leakRoom());
  const [ana, ben, cy] = pids as [string, string, string];
  let room = lobby;
  let t = 4_000_000;
  const act = (label: string, action: Parameters<typeof step>[1]) => {
    t += 1000;
    const res = step(room, action, t);
    room = res.room;
    audit(label, room, t, res.effects);
  };
  act('dealt', { type: 'host:start', by: SCREEN_HOST });
  act('drawing', { type: 'drawer:choose', by: asPlayer(ana, true), index: 1 });
  act('paused', { type: 'host:pause', by: asPlayer(ana, true) });
  act('kick the drawer', { type: 'host:kick', by: SCREEN_HOST, pid: ana });
  expect(room.phase).toBe('REVEAL');
  expect(room.paused).not.toBeNull();
  act('resuming', { type: 'host:resume', by: asPlayer(ben, true) });
  act('resumed', {
    type: 'timer',
    timer: 'resumeGo',
    turnId: room.turn!.id,
    epoch: room.timerEpoch,
  });
  act('upcoming chosen', { type: 'drawer:choose', by: asPlayer(ben, true), index: 0 });
  expect(room.upcoming!.word).not.toBeNull();
  act('next', { type: 'host:next', by: SCREEN_HOST });
  expect(room.turn!.drawerPid).toBe(ben);
  act('guess', {
    type: 'player:guess',
    by: asPlayer(cy),
    text: word(room),
    receivedAt: t + 1000,
    oneWayMs: 0,
  });
  act('skip while paused', { type: 'host:pause', by: SCREEN_HOST });
  act('skipped', { type: 'host:skip', by: SCREEN_HOST });
  // Cy, dealt next, can't choose until the pause is over.
  expect(room.upcoming!.drawerPid).toBe(cy);
  expect(reduce(room, { type: 'drawer:choose', by: asPlayer(cy), index: 2 }, t)).toEqual({
    ok: false,
    error: 'paused',
  });
  act('resuming again', { type: 'host:resume', by: SCREEN_HOST });
  act('resumed again', {
    type: 'timer',
    timer: 'resumeGo',
    turnId: room.turn!.id,
    epoch: room.timerEpoch,
  });
  act('upcoming chosen again', { type: 'drawer:choose', by: asPlayer(cy), index: 2 });
  act('ended', { type: 'host:end', by: SCREEN_HOST });
  expect(room.phase).toBe('FINAL');
  expect(room.upcoming).toBeNull();
});

// A close guess is held back from the feed and fx (F14, DECISIONS 37): only its phone hears it.
it('keeps a near miss of the word off the Screen until REVEAL', () => {
  const { room: lobby, pids } = withPlayers(['Ana', 'Ben'], leakRoom());
  let room = choose(
    step(lobby, { type: 'host:start', by: SCREEN_HOST }, 2_000_000).room,
    2_000_000,
  );
  const res = step(
    room,
    {
      type: 'player:guess',
      by: asPlayer(pids[1]!),
      text: `${word(room)}x`,
      receivedAt: 2_001_000,
      oneWayMs: 0,
    },
    2_001_000,
  );
  room = res.room;
  audit('near miss', room, 2_001_000, res.effects);
});

// ---------- Through the socket gateway ----------

const CODE = 'ABCD';

interface Client {
  name: string;
  socket: ClientSocket;
  /** Everything received: events in order, and the payload of every ack. */
  received: unknown[];
  emit(event: string, payload?: unknown): Promise<unknown>;
}

let server: Server | undefined;
let clients: Client[] = [];

afterEach(async () => {
  for (const c of clients) c.socket.disconnect();
  clients = [];
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
  vi.restoreAllMocks();
});

/** A store that can be told to throw once, to drive the gateway's logged failure path. */
class FlakyRoomStore extends InMemoryRoomStore {
  failNextSet = false;
  override set(room: Room): void {
    if (this.failNextSet) {
      this.failNextSet = false;
      throw new Error('store unavailable');
    }
    super.set(room);
  }
}

async function gateway() {
  const rooms = new FlakyRoomStore();
  const hostToken = generateHostToken();
  rooms.set(
    createRoom({
      code: CODE,
      hostTokenHash: hashHostToken(hostToken),
      now: 0,
      seed: 11,
      packs: [LEAK_PACK],
    }),
  );
  const mono = { now: 10_000 };
  server = createServer();
  attachSockets(server, {
    rooms,
    clock: () => 1_800_000_000_000,
    monotonic: () => mono.now,
    // Timers never fire on their own: the test moves turns on with host actions.
    scheduler: () => () => {},
  });
  server.listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  async function connect(name: string): Promise<Client> {
    const socket = connectClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    const received: unknown[] = [];
    socket.onAny((event: string, payload: unknown) => received.push([event, payload]));
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    const client: Client = {
      name,
      socket,
      received,
      emit: async (event, payload = {}) => {
        const ack: unknown = await socket.timeout(2000).emitWithAck(event, payload);
        received.push(['ack', event, ack]);
        return ack;
      },
    };
    clients.push(client);
    return client;
  }

  return { rooms, hostToken, mono, connect };
}

describe('word secrecy through the socket gateway', () => {
  it('no state, fx, ack or log line reaches a Screen or guesser with a secret before REVEAL', async () => {
    const logged: unknown[] = [];
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const)
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logged.push(args));

    const g = await gateway();
    const room = () => g.rooms.get(CODE)!;
    const screen = await g.connect('screen with token');
    expect(await screen.emit('screen:join', { code: CODE, hostToken: g.hostToken })).toEqual({
      ok: true,
    });
    const plain = await g.connect('screen');
    expect(await plain.emit('screen:join', { code: CODE })).toEqual({ ok: true });

    const players = new Map<Client, string>();
    async function join(name: string, letter: string) {
      const c = await g.connect(name);
      const ack = (await c.emit('player:join', {
        code: CODE,
        playerKey: letter.repeat(21),
        name,
        avatar: '🦊',
      })) as { ok: boolean; pid: string };
      expect(ack.ok).toBe(true);
      players.set(c, ack.pid);
      return c;
    }
    const ana = await join('Ana', 'a');
    const ben = await join('Ben', 'b');
    const cy = await join('Cy', 'c');

    // What each socket has had checked so far.
    const seen = new Map<Client, number>();
    let logsSeen = 0;
    /** A `ping` round trip on every socket flushes what the server sent it, then everything new is
     * checked against what that socket may see in the room as it is now. That holds only because
     * it runs after every single action: never batch actions between checkpoints. */
    async function checkpoint(label: string) {
      for (const c of clients) await c.emit('ping', { t: 0 });
      const r = room();
      visited.add(r.phase);
      for (const c of clients) {
        const pid = players.get(c);
        const who: Audience = pid ? { kind: 'player', pid } : { kind: 'screen' };
        const fresh = c.received.slice(seen.get(c) ?? 0);
        seen.set(c, c.received.length);
        expectNoLeak(fresh, allowedFor(r, who), `${label}: ${c.name}`);
      }
      expectNoLeak(logged.slice(logsSeen), allowedFor(r, { kind: 'all' }), `${label}: console`);
      logsSeen = logged.length;
    }
    const lastState = (c: Client) =>
      (c.received.filter((e) => Array.isArray(e) && e[0] === 'state').at(-1) as [string, View])[1];

    visited = new Set();
    await checkpoint('lobby');

    for (const [n, drawer] of [ana, ben, cy].entries()) {
      expect(await screen.emit(n === 0 ? 'host:start' : 'host:next')).toEqual({ ok: true });
      expect(room().turn!.drawerPid).toBe(players.get(drawer));
      await checkpoint(`turn ${n + 1} dealt`);
      // Positive control: the drawer's socket did get the three choices.
      expect(tokens(lastState(drawer))).toEqual(
        expect.arrayContaining(room().turn!.choices.map((c) => c.word)),
      );
      // A guesser can't choose for the drawer.
      const other = [ana, ben, cy].find((c) => c !== drawer)!;
      expect(await other.emit('drawer:choose', { index: 0 })).toEqual({
        ok: false,
        error: 'notDrawer',
      });
      expect(await drawer.emit('drawer:choose', { index: n })).toEqual({ ok: true });
      await checkpoint(`turn ${n + 1} starts`);
      // Positive control: the drawer's socket did get the word.
      expect(tokens(lastState(drawer))).toContain(word(room()));

      const guessers = [ana, ben, cy].filter((c) => c !== drawer);
      expect(await guessers[0]!.emit('player:guess', { text: 'payong' })).toEqual({ ok: true });
      await checkpoint(`turn ${n + 1} wrong guess`);
      // A near miss: only its own phone hears about it until REVEAL.
      const near = `${word(room())} ko`;
      expect(await guessers[1]!.emit('player:guess', { text: near })).toEqual({ ok: true });
      await checkpoint(`turn ${n + 1} near miss`);
      // Past the 700 ms limit before this guesser's next guess.
      g.mono.now += GUESS_INTERVAL_MS;
      if (n === 0) {
        // The right guess fails inside the gateway once: it is logged, without the guess.
        g.rooms.failNextSet = true;
        expect(await guessers[0]!.emit('player:guess', { text: word(room()) })).toEqual({
          ok: false,
          error: 'serverError',
        });
        expect(logged.length).toBeGreaterThan(logsSeen);
        await checkpoint('failed guess, logged');
      }
      expect(await guessers[0]!.emit('player:guess', { text: word(room()) })).toEqual({ ok: true });
      await checkpoint(`turn ${n + 1} right guess`);
      // Refused guesses of the word: the drawer, a repeat, and one too long to be a guess. Their
      // acks are checked like everything else.
      expect(await drawer.emit('player:guess', { text: word(room()) })).toEqual({
        ok: false,
        error: 'drawerCannotGuess',
      });
      expect(await guessers[0]!.emit('player:guess', { text: word(room()) })).toEqual({
        ok: false,
        error: 'alreadyGuessed',
      });
      expect(
        await guessers[1]!.emit('player:guess', { text: word(room()).padEnd(41, 'z') }),
      ).toEqual({ ok: false, error: 'invalidPayload' });
      await checkpoint(`turn ${n + 1} refused guesses`);
      expect(
        lastState(guessers[0]!).players.find((p) => p.pid === players.get(guessers[0]!))!.guessed,
      ).toBe(true);

      if (n === 0) {
        await join('Dee', 'd');
        await checkpoint('late join');
      }
      expect(await screen.emit('host:skip')).toEqual({ ok: true });
      await checkpoint(`reveal ${n + 1}`);
      expect(lastState(plain).turn!.word).toBe(word(room()));
      expect((lastState(plain) as ScreenView).almost).toEqual([
        { pid: players.get(guessers[1]!), text: near },
        { pid: players.get(guessers[0]!), text: 'payong' },
      ]);
      expect(await guessers[1]!.emit('player:guess', { text: word(room()) })).toEqual({
        ok: false,
        error: 'wrongPhase',
      });
      await checkpoint(`reveal ${n + 1} late guess`);
    }
    // F23: Dee joined while turns remained, so cycle 1 has a fourth turn. Their deal is skipped,
    // which ends cycle 1.
    expect(await screen.emit('host:next')).toEqual({ ok: true });
    await checkpoint('late joiner dealt in cycle 1');
    const dee = Object.values(room().players).find((p) => p.name === 'Dee')!.pid;
    expect([room().phase, room().cycle, room().turn!.drawerPid]).toEqual(['CHOOSING', 1, dee]);
    expect(await screen.emit('host:skip')).toEqual({ ok: true });
    await checkpoint('scoreboard');
    // Cycle 1 done: SCOREBOARD, then cycle 2 (Dee included), each deal skipped, then FINAL.
    expect(room().phase).toBe('SCOREBOARD');
    expect(await screen.emit('host:next')).toEqual({ ok: true });
    await checkpoint('cycle 2 dealt');
    expect(room().turnOrder).toHaveLength(4);
    for (let n = 1; n <= 4; n++) {
      expect(await screen.emit('host:skip')).toEqual({ ok: true });
      await checkpoint(`cycle 2 deal ${n} skipped`);
    }
    expect(room().phase).toBe('FINAL');
    expect([...visited]).toEqual(['LOBBY', 'CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD', 'FINAL']);
  });
});

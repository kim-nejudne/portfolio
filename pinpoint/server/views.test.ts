import { describe, expect, it } from 'vitest';
import { EMOJI } from '#shared/constants.js';
import type {
  Category,
  Difficulty,
  LatLng,
  Mode,
  Phase,
  Place,
  Room,
  View,
} from '#shared/types.js';
import { type Action, type Effect, playerIdentity, reduce } from './reducer.js';
import { createRoom } from './roomStore.js';
import { toView, vipControls } from './views.js';

const CODE = 'ABCD';
const T0 = 1_000_000;
const WORLD = {
  id: 'world',
  name: 'World',
  emoji: '🌍',
  box: { south: -58, west: -180, north: 78, east: 180 },
  labelStyle: 'cityCountry' as const,
  counts: { easy: { city: 30, landmark: 0 } },
};
const CTX = { now: T0 + 500, publicUrl: 'https://pinpoint.example', categories: [WORLD] };
const key = (n: number) => `secret-key-${String(n).padStart(10, '0')}`;
const idOf = (n: number) => playerIdentity(CODE, key(n)).id;

/** A lobby with players 1…n; player 1 is the VIP. */
function lobby(n: number): Room {
  let room = createRoom(CODE, T0, 7);
  for (let i = 1; i <= n; i++) {
    const res = reduce(
      room,
      { type: 'player:join', playerKey: key(i), name: `P${i}`, emoji: EMOJI[i]! },
      T0 + i,
    );
    expect(res.error).toBeUndefined();
    room = res.room;
  }
  return room;
}

describe('lobby views', () => {
  it('carry no player key or key hash, in any role', () => {
    const room = lobby(3);
    const views = [
      toView(room, 'screen', undefined, CTX),
      ...[1, 2, 3].map((n) => toView(room, 'player', idOf(n), CTX)),
    ];
    for (const view of views) {
      const json = JSON.stringify(view);
      for (const n of [1, 2, 3]) {
        expect(json).not.toContain(key(n));
        expect(json).not.toContain(playerIdentity(CODE, key(n)).keyHash);
      }
      expect(json).not.toContain('keyHash');
    }
  });

  it('give the Screen the code, join URL, serverNow, players and settings', () => {
    const view = toView(lobby(2), 'screen', undefined, CTX);
    expect(view).toMatchObject({
      role: 'screen',
      serverNow: CTX.now,
      code: CODE,
      joinUrl: 'https://pinpoint.example/play/ABCD',
      phase: 'LOBBY',
      settings: { mode: 'name', difficulty: 'mixed', rounds: 10, timerSeconds: 30 },
      region: null,
      round: null,
      reveal: null,
    });
    expect(view.players.map((p) => [p.name, p.isVip, p.total, p.rank])).toEqual([
      ['P1', true, 0, 1],
      ['P2', false, 0, 1],
    ]);
  });

  it("add settings, the player list and lobby controls to the VIP's view only", () => {
    const room = lobby(2);
    const vip = toView(room, 'player', idOf(1), CTX);
    expect(vip).toMatchObject({
      role: 'player',
      serverNow: CTX.now,
      vipName: 'P1',
      playerCount: 2,
    });
    expect(vip.me.id).toBe(idOf(1));
    expect(vip.vip?.controls).toEqual(['start', 'kick']);
    expect(vip.vip?.players.map((p) => p.id)).toEqual([idOf(1), idOf(2)]);
    expect(vip.settings).toEqual(room.settings);

    const other = toView(room, 'player', idOf(2), CTX);
    expect(other.vip).toBeNull();
    expect(other.me.id).toBe(idOf(2));
    expect(other.vipName).toBe('P1');
  });

  it('name the chosen live category and say whether any category is live, in every role', () => {
    const room = { ...lobby(2), screenCount: 1 };
    room.settings = { ...room.settings, categoryId: 'world' };
    for (const view of [
      toView(room, 'screen', undefined, CTX),
      toView(room, 'player', idOf(2), CTX),
    ]) {
      expect(view).toMatchObject({ categoryName: 'World', hasCategories: true });
    }
    const vip = toView(room, 'player', idOf(1), CTX);
    expect(vip.vip).toMatchObject({ categories: [WORLD], screenCount: 1 });

    const empty = toView(room, 'screen', undefined, { ...CTX, categories: [] });
    expect(empty).toMatchObject({ categoryName: null, hasCategories: false });
  });

  it('refuse to build a view for a player who is not in the room', () => {
    expect(() => toView(lobby(1), 'player', 'nobody', CTX)).toThrow();
  });
});

describe('vipControls', () => {
  it('follows the spec table per phase', () => {
    expect(vipControls('GUESSING', false, false)).toEqual(['pause', 'skipRound', 'kick', 'end']);
    expect(vipControls('REVEAL', true, false)).toEqual(['next', 'resume', 'skipRound', 'end']);
    expect(vipControls('SCOREBOARD', false, false)).toContain('roundSettings');
    expect(vipControls('FINAL', false, true)).toEqual(['rematchCancel']);
    expect(vipControls('FINAL', false, false)).toEqual(['rematch', 'backToLobby', 'kick']);
  });
});

// ---- Game views ----

// The target's coordinates share no 1-decimal form with any other number in the fixture (box, scale,
// clock, aims, locks); a coincidence is fixed here, never by loosening the checks (spec: Security).
const TARGET = { lat: 12.3456, lng: -98.7654 };
const SECRET = {
  wikidataId: 'Q987654321',
  countryId: 'Q4242424',
  countryName: 'Secretland',
  fact: 'A fact only the reveal may tell.',
  pictureName: 'Hidden Tower of Nowhere',
  photoId: 'photo-id-zzzzzz',
  commonsFile: 'File:Hidden_Tower_of_Nowhere.jpg',
};
const BOX = { south: 5, west: -110, north: 30, east: -80 };
const P2_AIM = { lat: 41.2468, lng: 62.1357 };
const P3_LOCK = { lat: -33.8642, lng: 151.2097 };
const P1_LOCK = { lat: 7.1111, lng: -84.4444 };

function secretPlace(id: string, kind: Place['kind']): Place {
  const picture = kind === 'landmark';
  return {
    id,
    kind,
    name: picture ? SECRET.pictureName : 'Testville',
    displayName: picture ? SECRET.pictureName : 'Testville',
    autoDisplayName: true,
    fact: SECRET.fact,
    lat: TARGET.lat,
    lng: TARGET.lng,
    coordsSource: 'wikidata',
    wikidataId: SECRET.wikidataId,
    countryId: SECRET.countryId,
    countryName: SECRET.countryName,
    ...(picture && {
      photo: {
        id: SECRET.photoId,
        width: 1600,
        height: 1200,
        author: 'Jane Doe',
        licence: 'CC BY-SA 4.0',
        licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        commonsFile: SECRET.commonsFile,
        sourceUrl: `https://commons.wikimedia.org/wiki/${SECRET.commonsFile}`,
      },
    }),
  };
}

function secretCategory(): Category {
  const live: Category['live'] = {};
  for (const level of ['easy', 'medium', 'hard'] as Difficulty[]) {
    const places = [0, 1, 2, 3, 4, 5].flatMap((i) => [
      secretPlace(`city-${level}-${i}`, 'city'),
      secretPlace(`landmark-${level}-${i}`, 'landmark'),
    ]);
    live[level] = { places, reviewed: true, updatedAt: 0 };
  }
  return {
    id: 'secret',
    name: 'Secret',
    emoji: null,
    box: BOX,
    labelStyle: 'city',
    draftMeta: null,
    hidden: false,
    live,
    draft: {},
    createdAt: 0,
    updatedAt: 0,
  };
}

const SECRET_SUMMARY = {
  id: 'secret',
  name: 'Secret',
  emoji: null,
  box: BOX,
  labelStyle: 'city' as const,
  counts: { easy: { city: 6, landmark: 6 } },
};
const GAME_CTX = { ...CTX, categories: [SECRET_SUMMARY] };

/** A room driven through the reducer, firing the newest scheduled timer by name (and step `k`). */
class Game {
  room: Room;
  now = T0;
  private pending: Extract<Effect, { type: 'schedule' }>[] = [];

  constructor(mode: Mode, players = 3) {
    this.room = createRoom(CODE, T0, 7);
    for (let i = 1; i <= players; i++)
      this.act({ type: 'player:join', playerKey: key(i), name: `P${i}`, emoji: EMOJI[i]! });
    this.act({ type: 'screen:join' });
    this.act({
      type: 'vip:settings',
      by: idOf(1),
      settings: { categoryId: 'secret', rounds: 5, mode },
      liveIds: ['secret'],
    });
  }

  act(action: Action): this {
    this.now += 10;
    const res = reduce(this.room, action, this.now);
    expect(res.error).toBeUndefined();
    this.room = res.room;
    for (const e of res.effects) if (e.type === 'schedule') this.pending.push(e);
    return this;
  }

  fire(timer: string, k?: number): this {
    const i = this.pending.findLastIndex(
      (e) => e.timer === timer && (k === undefined || e.k === k),
    );
    if (i < 0) throw new Error(`no ${timer} pending`);
    const [s] = this.pending.splice(i, 1);
    this.now = s!.at - 10;
    return this.act({ ...s!, type: 'timer' });
  }

  start(): this {
    return this.act({ type: 'vip:start', by: idOf(1), category: secretCategory() });
  }

  views(): View[] {
    return [
      toView(this.room, 'screen', undefined, GAME_CTX),
      ...Object.keys(this.room.players).map((id) => toView(this.room, 'player', id, GAME_CTX)),
    ];
  }
}

/** Every text form of a coordinate the leak test refuses: 1–4 decimals, signed and unsigned. */
const forms = (n: number) => [1, 2, 3, 4].flatMap((d) => [n.toFixed(d), Math.abs(n).toFixed(d)]);
const pointForms = (p: LatLng) => [
  ...forms(p.lat),
  ...forms(p.lng),
  `${p.lat},${p.lng}`,
  `${p.lat}, ${p.lng}`,
];

function expectNoSecrets(view: View, mode: Mode) {
  const json = JSON.stringify(view);
  const banned = [
    ...pointForms(TARGET),
    SECRET.wikidataId,
    SECRET.countryId,
    SECRET.countryName,
    SECRET.fact,
    SECRET.photoId,
    SECRET.commonsFile,
    'Hidden_Tower',
    'city-',
    'landmark-',
    ...(mode === 'picture' ? [SECRET.pictureName, 'Jane Doe'] : []),
  ];
  for (const text of banned) expect(json, `${view.role} view leaks ${text}`).not.toContain(text);
  // Other players' pins: only the viewer's own lock may appear.
  const own = view.role === 'player' ? view.me.id : null;
  if (own !== idOf(2)) for (const t of pointForms(P2_AIM)) expect(json).not.toContain(t);
  if (own !== idOf(3)) for (const t of pointForms(P3_LOCK)) expect(json).not.toContain(t);
  if (own !== idOf(1)) for (const t of pointForms(P1_LOCK)) expect(json).not.toContain(t);
}

describe('the leak test', () => {
  for (const mode of ['name', 'picture'] as Mode[]) {
    it(`finds no target, place secret or other player's pin in any ${mode}-mode view before REVEAL`, () => {
      const game = new Game(mode);
      const phases: Phase[] = [];
      const check = () => {
        phases.push(game.room.phase);
        for (const view of game.views()) expectNoSecrets(view, mode);
      };
      check(); // LOBBY
      game.start();
      check(); // INTRO
      game.fire('introDone');
      check(); // GUESSING
      game
        .act({ type: 'player:aim', by: idOf(2), ...P2_AIM })
        .act({ type: 'player:lockIn', by: idOf(3), ...P3_LOCK })
        .act({ type: 'player:lockIn', by: idOf(1), ...P1_LOCK });
      check(); // GUESSING with aims and locks
      expect(phases).toEqual(['LOBBY', 'INTRO', 'GUESSING', 'GUESSING']);

      // The fixture is live: the same checks fail once the round reveals.
      game.fire('guessUp');
      const screen = JSON.stringify(toView(game.room, 'screen', undefined, GAME_CTX));
      expect(screen).toContain(String(TARGET.lat));
      expect(screen).toContain(SECRET.fact);
      if (mode === 'picture') {
        expect(screen).toContain(SECRET.pictureName);
        expect(screen).toContain('Jane Doe');
      }
    });
  }

  it("shows a player their own aim and lock but never another's", () => {
    const game = new Game('name').start().fire('introDone');
    game
      .act({ type: 'player:aim', by: idOf(2), ...P2_AIM })
      .act({ type: 'player:lockIn', by: idOf(3), ...P3_LOCK });
    const p3 = toView(game.room, 'player', idOf(3), GAME_CTX);
    expect(p3.round).toMatchObject({ myLock: P3_LOCK, myAim: null });
    expect(JSON.stringify(p3)).not.toContain(String(P2_AIM.lat));
    const p2 = toView(game.room, 'player', idOf(2), GAME_CTX);
    expect(p2.round).toMatchObject({ myLock: null, myAim: P2_AIM });
    expect(JSON.stringify(p2)).not.toContain(String(P3_LOCK.lat));
  });
});

describe('game views', () => {
  it('give both roles the round header, gate, prompt and region from INTRO', () => {
    const game = new Game('name').start();
    const screen = toView(game.room, 'screen', undefined, GAME_CTX);
    expect(screen.region).toEqual({ box: BOX, scale: game.room.game!.scale });
    expect(screen.round).toEqual({
      number: 1,
      total: 5,
      multiplier: 1,
      endsAt: null,
      gate: 'nowBoarding',
      lockedIn: [],
      prompt: { kind: 'name', displayName: 'Testville' },
    });
    const player = toView(game.room, 'player', idOf(2), GAME_CTX);
    expect(player.region).toEqual(screen.region);
    expect(player.round).toMatchObject({
      number: 1,
      total: 5,
      prompt: { kind: 'name', displayName: 'Testville' },
      myLock: null,
    });
    expect(player.vip).toBeNull();
    expect(toView(game.room, 'player', idOf(1), GAME_CTX).vip?.controls).toEqual([
      'pause',
      'skipRound',
      'kick',
      'end',
    ]);
  });

  it('track lock-ins in GUESSING: Screen ids, emoji still guessing, endsAt and Boarding', () => {
    const game = new Game('name').start().fire('introDone');
    game.act({ type: 'player:lockIn', by: idOf(2), ...P3_LOCK });
    const screen = toView(game.room, 'screen', undefined, GAME_CTX);
    expect(screen.round).toMatchObject({
      gate: 'boarding',
      lockedIn: [idOf(2)],
      endsAt: game.room.game!.current!.endsAt,
    });
    expect(screen.round?.endsAt).toBeGreaterThan(game.now);
    expect(screen.reveal).toBeNull();
    const player = toView(game.room, 'player', idOf(1), GAME_CTX);
    expect(player.round?.stillGuessing).toEqual([EMOJI[1], EMOJI[3]]);
  });

  it('give Picture mode a photo prompt whose credit never names the author, and a thumb', () => {
    const game = new Game('picture').start();
    const token = game.room.game!.current!.photoToken;
    const screen = toView(game.room, 'screen', undefined, GAME_CTX);
    expect(screen.round?.prompt).toEqual({
      kind: 'picture',
      photoUrl: `/api/photos/${token}`,
      credit: 'Photo: Wikimedia Commons contributor · CC BY-SA 4.0',
    });
    const player = toView(game.room, 'player', idOf(2), GAME_CTX);
    expect(player.round?.prompt).toMatchObject({ thumbUrl: `/api/photos/${token}/thumb` });
  });

  it('read Delayed on the gate while paused', () => {
    const game = new Game('name').start().fire('introDone');
    const room: Room = {
      ...game.room,
      paused: { reasons: ['vip'], since: game.now, remainingMs: {}, resumeAt: null },
    };
    expect(toView(room, 'screen', undefined, GAME_CTX).round?.gate).toBe('delayed');
  });

  it("show the Screen the answer and every row in REVEAL, and each player's own result only once revealedCount reaches them", () => {
    // P1 far, P2 near, P3 nearest; P4 drops before GUESSING, so misses the round.
    const game = new Game('name', 4)
      .start()
      .act({ type: 'player:connection', playerId: idOf(4), connected: false })
      .fire('introDone');
    game
      .act({ type: 'player:lockIn', by: idOf(1), lat: 28, lng: -82 })
      .act({ type: 'player:lockIn', by: idOf(2), lat: 13, lng: -99 })
      .act({ type: 'player:lockIn', by: idOf(3), ...TARGET });
    game.fire('allLocked');
    expect(game.room.phase).toBe('REVEAL');
    // P4 never locked, but nobody is still guessing once the round reveals.
    expect(toView(game.room, 'player', idOf(1), GAME_CTX).round?.stillGuessing).toEqual([]);
    const order = game.room.game!.current!.results!.map((r) => r.playerId);
    const scored = game.room.game!.current!.results!.filter((r) => r.distanceKm !== null).length;

    const screen = toView(game.room, 'screen', undefined, GAME_CTX);
    expect(screen.reveal).toMatchObject({
      place: {
        name: 'Testville',
        fact: SECRET.fact,
        position: TARGET,
        credit: null,
        photoUrl: null,
      },
      revealStage: 'pins',
      revealedCount: 0,
    });
    expect(screen.reveal?.results.map((r) => r.playerId)).toEqual(order);
    const mine = (n: number) => toView(game.room, 'player', idOf(n), GAME_CTX).myResult;
    for (const n of [1, 2, 3, 4]) expect(mine(n)).toBeNull();

    game.fire('revealTarget');
    for (let k = 0; k < scored; k++) {
      game.fire('revealStep', k);
      for (const [i, id] of order.entries()) {
        const view = toView(game.room, 'player', id, GAME_CTX);
        if (i <= k) expect(view.myResult?.playerId).toBe(id);
        else expect(view.myResult).toBeNull();
      }
    }

    game.fire('revealDone');
    expect(game.room.phase).toBe('SCOREBOARD');
    // From SCOREBOARD every participant sees their row of the last round, the missed one too.
    expect(mine(4)).toMatchObject({ position: null, points: 0 });
    expect(mine(3)?.bullseye).toBe(true);
    expect(toView(game.room, 'player', idOf(2), GAME_CTX).round).toMatchObject({
      number: 1,
      total: 5,
    });
  });

  it('give SCOREBOARD and FINAL standings by rank with movement since the last board', () => {
    const game = new Game('name', 2).start().fire('introDone');
    // Round 1: P1 nearest. Round 2: P2 nearest by far and overtakes.
    game
      .act({ type: 'player:lockIn', by: idOf(1), ...TARGET })
      .act({ type: 'player:lockIn', by: idOf(2), lat: 20, lng: -90 })
      .fire('allLocked')
      .fire('revealDone');
    let screen = toView(game.room, 'screen', undefined, GAME_CTX);
    expect(screen.reveal).toBeNull();
    expect(screen.standings?.map((s) => [s.playerId, s.rank, s.movement])).toEqual([
      [idOf(1), 1, 0],
      [idOf(2), 2, 0],
    ]);
    expect(screen.standings?.[0]).toMatchObject({ roundPoints: 1000, total: 1000 });
    // SCOREBOARD has the last round (now revealed) on the round header.
    expect(screen.round?.number).toBe(1);

    game.fire('scoreboardDone').fire('introDone');
    game
      .act({ type: 'player:lockIn', by: idOf(1), lat: 29, lng: -81 })
      .act({ type: 'player:lockIn', by: idOf(2), ...TARGET })
      .fire('allLocked');
    expect(toView(game.room, 'screen', undefined, GAME_CTX).standings).toBeNull();
    game.fire('revealDone');
    screen = toView(game.room, 'screen', undefined, GAME_CTX);
    const rows = screen.standings!;
    expect(rows[0]!.playerId).toBe(idOf(2));
    expect(rows.map((s) => s.movement)).toEqual([1, -1]);
    expect(rows[0]!.total).toBe(
      rows[0]!.roundPoints +
        game.room.game!.played[0]!.results!.find((r) => r.playerId === idOf(2))!.points,
    );

    for (let n = 3; n <= 5; n++) {
      game.fire('scoreboardDone').fire('introDone').fire('guessUp').fire('revealDone');
    }
    expect(game.room.phase).toBe('FINAL');
    screen = toView(game.room, 'screen', undefined, GAME_CTX);
    expect(screen.standings).toHaveLength(2);
    expect(screen.final).toBeNull();
    expect(toView(game.room, 'player', idOf(1), GAME_CTX).vip?.controls).toEqual([
      'rematch',
      'backToLobby',
      'kick',
    ]);
  });
});

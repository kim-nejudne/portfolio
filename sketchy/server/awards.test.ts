// Tonight's awards (F50): the Final section of UI by role and phase (Screen) in docs/spec.md.
import { describe, expect, it } from 'vitest';
import { REVEAL_MS } from '../shared/constants.js';
import type {
  Action,
  Award,
  Effect,
  PlayerView,
  Room,
  ScreenView,
  TurnSummary,
} from '../shared/types.js';
import { computeAwards, type AwardPlayer } from './awards.js';
import { SCREEN_HOST, asPlayer, choose, secretWord, started, step } from './test/rooms.js';
import { toView } from './views.js';

/** Players by name: `score`, joined in the order given. */
function players(scores: Record<string, number>): AwardPlayer[] {
  return Object.entries(scores).map(([pid, score], i) => ({ pid, score, joinedAt: i }));
}

let nextTurn = 1;
/** A turn summary; only what a test sets matters. */
function turn(drawerPid: string, s: Partial<TurnSummary> = {}): TurnSummary {
  return {
    turnId: nextTurn++,
    drawerPid,
    word: 'tsinelas',
    points: {},
    correct: [],
    close: {},
    wrong: {},
    hasInk: true,
    endReason: 'time',
    ...s,
  };
}

/** A turn where `correct` guessed in this order and time; the drawer earns `drawerPoints`. */
function guessed(
  drawerPid: string,
  correct: [pid: string, elapsedMs: number][],
  drawerPoints = 100,
  extra: Partial<TurnSummary> = {},
): TurnSummary {
  return turn(drawerPid, {
    correct: correct.map(([pid, elapsedMs]) => ({ pid, elapsedMs })),
    points: { [drawerPid]: drawerPoints, ...Object.fromEntries(correct.map(([p]) => [p, 200])) },
    ...extra,
  });
}

const kinds = (awards: Award[]) => Object.fromEntries(awards.map((a) => [a.kind, a.pid]));

describe('each award alone', () => {
  // One award per case, so the one-per-player rule never interferes.
  it('🎨 Picasso: most drawer points over the game', () => {
    const p = players({ ana: 0, ben: 0, cy: 0 });
    const h = [guessed('ana', [['ben', 1]], 300), guessed('ben', [['ana', 1]], 200)];
    h.push(guessed('ben', [['ana', 1]], 150)); // Ben 350 in total beats Ana's one 300
    const picasso = computeAwards(p, h).find((a) => a.kind === 'picasso');
    expect(picasso).toEqual({ kind: 'picasso', pid: 'ben' });
  });

  it('⚡ Bilis!: the fastest corrected guess of the game', () => {
    const p = players({ ana: 0, ben: 0, cy: 0 });
    const h = [
      guessed(
        'ana',
        [
          ['ben', 9000],
          ['cy', 9500],
        ],
        300,
      ),
      guessed('ben', [['cy', 4200]]),
      guessed('cy', [['ben', 4300]]),
    ];
    expect(kinds(computeAwards(p, h)).bilis).toBe('cy');
  });

  it('🎯 Sharpshooter: most correct guesses', () => {
    const p = players({ ana: 0, ben: 0, cy: 0 });
    const h = [
      guessed('ana', [
        ['ben', 1000],
        ['cy', 2000],
      ]),
      guessed('ben', [['cy', 1000]]),
      guessed('cy', [['ben', 900]]),
      guessed('ana', [['cy', 5000]]),
    ];
    // Cy 3, Ben 2. (Ben is fastest, so Bilis takes him first if it needs to.)
    expect(kinds(computeAwards(p, h)).sharpshooter).toBe('cy');
  });

  it('😅 Malapit na!: most close guesses', () => {
    const p = players({ ana: 0, ben: 0, cy: 0 });
    const h = [
      turn('ana', { close: { ben: 1, cy: 2 } }),
      turn('ben', { close: { cy: 1, ana: 2 } }),
    ];
    expect(kinds(computeAwards(p, h)).malapitNa).toBe('cy');
  });

  it('🤪 Most creative: most wrong guesses', () => {
    const p = players({ ana: 0, ben: 0, cy: 0 });
    const h = [
      turn('ana', { wrong: { ben: 4, cy: 2 } }),
      turn('cy', { wrong: { ben: 1, ana: 3 } }),
    ];
    expect(kinds(computeAwards(p, h)).mostCreative).toBe('ben');
  });

  it('🖼️ Modern art: a drawing nobody got, with its turnId', () => {
    const p = players({ ana: 0, ben: 0, cy: 0 });
    const got = guessed('ana', [['ben', 1000]]);
    const missed = turn('cy');
    const art = computeAwards(p, [got, missed]).find((a) => a.kind === 'modernArt');
    expect(art).toEqual({ kind: 'modernArt', pid: 'cy', turnId: missed.turnId });
  });

  it("🖼️ Modern art: only turns that ran out of time; skipped, ended or abandoned ones don't count", () => {
    const p = players({ ana: 0, ben: 0, cy: 0 });
    const h = (['skip', 'end', 'drawerGone'] as const).map((endReason) =>
      turn('ana', { endReason }),
    );
    expect(computeAwards(p, h)).toEqual([]);
    const timed = turn('ana');
    expect(computeAwards(p, [...h, timed])).toEqual([
      { kind: 'modernArt', pid: 'ana', turnId: timed.turnId },
    ]);
  });

  it('⚡ Bilis!: a tie at 0 ms (sent within the latency correction) goes to the lower-ranked', () => {
    const p = players({ ana: 900, ben: 500 });
    const h = [
      guessed(
        'cy',
        [
          ['ana', 0],
          ['ben', 0],
        ],
        0,
      ),
    ];
    expect(kinds(computeAwards(p, h)).bilis).toBe('ben');
  });

  it('🖼️ Modern art: most drawings nobody got, pointing at the latest of them', () => {
    const p = players({ ana: 0, ben: 0, cy: 0 });
    const a1 = turn('ana');
    const b1 = turn('ben');
    const b2 = turn('ben');
    const art = computeAwards(p, [a1, b1, guessed('cy', [['ana', 1]], 0), b2]).find(
      (a) => a.kind === 'modernArt',
    );
    expect(art).toEqual({ kind: 'modernArt', pid: 'ben', turnId: b2.turnId });
  });
});

describe('who qualifies', () => {
  it('an award nobody qualifies for is skipped', () => {
    // Every turn guessed by everyone, no close or wrong guesses: no Malapit na, Most creative or
    // Modern art. Drawers who scored 0 (a turn ended before anyone got it) don't make Picasso.
    const p = players({ ana: 0, ben: 0, cy: 0 });
    const h = [guessed('ana', [['ben', 1000]], 0)];
    const awards = computeAwards(p, h);
    expect(awards.map((a) => a.kind)).toEqual(['bilis']);
  });

  it('no history: no awards', () => {
    expect(computeAwards(players({ ana: 0, ben: 0 }), [])).toEqual([]);
  });

  it('a player who left is not awarded; the next best is', () => {
    const p = players({ ana: 0, ben: 0 });
    const h = [guessed('ana', [['gone', 500]]), guessed('ben', [['ana', 900]])];
    expect(kinds(computeAwards(p, h)).bilis).toBe('ana');
  });

  it('a guess counted only for whoever made it: 0 close or wrong guesses never qualify', () => {
    const p = players({ ana: 0, ben: 0 });
    const h = [turn('ana', { close: { ben: 0 }, wrong: { ben: 0 } })];
    expect(computeAwards(p, h).map((a) => a.kind)).toEqual(['modernArt']);
  });
});

describe('at most one per player, lowest-ranked first', () => {
  it('a player who leads everything gets one award; the rest go to the next best', () => {
    // Ana tops every stat; Ben and Cy trail her.
    const p = players({ ana: 900, ben: 500, cy: 100 });
    const h = [
      guessed(
        'ana',
        [
          ['ben', 3000],
          ['cy', 6000],
        ],
        400,
        { close: { ben: 1 }, wrong: { cy: 1 } },
      ),
      guessed('ben', [['ana', 1000]], 300, { close: { ana: 3 }, wrong: { ana: 5 } }),
      guessed('cy', [['ana', 2000]], 100, { close: { ana: 2, cy: 0 }, wrong: { ana: 4 } }),
    ];
    const awards = computeAwards(p, h);
    const pids = awards.map((a) => a.pid);
    expect(new Set(pids).size).toBe(pids.length);
    // Ana takes Picasso, the first she leads. Among Ben and Cy, the lower-ranked Cy wins the tie on
    // Sharpshooter (1 each), and Ben, fastest of the two, takes Bilis.
    expect(awards).toEqual([
      { kind: 'picasso', pid: 'ana' },
      { kind: 'bilis', pid: 'ben' },
      { kind: 'sharpshooter', pid: 'cy' },
    ]);
  });

  it('the lowest-ranked of two leaders picks first', () => {
    // Ben and Cy both lead an award: Cy (lower) leads Malapit na and Most creative, Ben leads
    // Most creative too (tied). The lower-ranked Cy takes Malapit na (spec order); Most creative
    // then goes to Ben, its best among those without one.
    const p = players({ ben: 500, cy: 100 });
    const h = [
      turn('ben', { close: { cy: 2 }, wrong: { cy: 3 } }),
      turn('cy', { wrong: { ben: 3 } }),
    ];
    const awards = computeAwards(p, h);
    expect(kinds(awards)).toMatchObject({ malapitNa: 'cy', mostCreative: 'ben' });
  });

  it('a tie on a stat goes to the lower-ranked player', () => {
    const p = players({ ana: 900, ben: 500, cy: 100 });
    const h = [turn('ana', { wrong: { ben: 2, cy: 2 } }), guessed('ben', [['ana', 1]])];
    expect(kinds(computeAwards(p, h)).mostCreative).toBe('cy');
  });

  it('a score tie ranks the later joiner lower', () => {
    const p = players({ ana: 500, ben: 500 });
    const h = [turn('cy', { wrong: { ana: 2, ben: 2 } })];
    expect(kinds(computeAwards(p, h)).mostCreative).toBe('ben');
  });

  it('an award whose only qualifiers already hold one is skipped', () => {
    // Ana leads Bilis and Sharpshooter; Ben has no correct guess at all.
    const p = players({ ana: 900, ben: 100 });
    const h = [
      guessed('ben', [['ana', 1000]], 0),
      guessed('ben', [['ana', 1200]], 0),
      turn('ana', { close: { ben: 1 } }),
    ];
    const awards = computeAwards(p, h);
    // Ben (lowest) takes Malapit na, the only one he qualifies for; Ana takes Bilis, the first she
    // leads. Sharpshooter and Modern art (her turn nobody got) are hers too, so they're skipped.
    expect(awards).toEqual([
      { kind: 'bilis', pid: 'ana' },
      { kind: 'malapitNa', pid: 'ben' },
    ]);
  });

  it('awards come back in the spec order, whoever got them first', () => {
    const p = players({ ana: 900, ben: 500, cy: 100 });
    const h = [
      guessed('ana', [['ben', 1000]], 300, { wrong: { cy: 2 } }),
      turn('ben', { close: { cy: 1 } }),
    ];
    const order: Award['kind'][] = [
      'picasso',
      'bilis',
      'sharpshooter',
      'malapitNa',
      'mostCreative',
      'modernArt',
    ];
    const got = computeAwards(p, h).map((a) => order.indexOf(a.kind));
    expect(got).toEqual([...got].sort((x, y) => x - y));
  });

  it('ten players over a full game: one award each at most, and six handed out', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const p = players(Object.fromEntries(names.map((n, i) => [n, 1000 - i * 50])));
    const h = names.map((d, i) =>
      i % 3 === 0
        ? turn(d, { wrong: { [names[(i + 1) % 10]!]: 2 }, close: { [names[(i + 2) % 10]!]: 1 } })
        : guessed(
            d,
            names.filter((n) => n !== d).map((n, j) => [n, 1000 + j * 700 + i * 13]),
            200 + i * 10,
          ),
    );
    const awards = computeAwards(p, h);
    expect(awards).toHaveLength(6);
    expect(new Set(awards.map((a) => a.pid)).size).toBe(6);
  });
});

// ---------- Through the reducer ----------

const guess = (pid: string, text: string, receivedAt: number): Action => ({
  type: 'player:guess',
  by: asPlayer(pid),
  text,
  receivedAt,
  oneWayMs: 40,
});

const timer = (room: Room, name: 'drawUp' | 'revealDone'): Action => ({
  type: 'timer',
  timer: name,
  turnId: room.turn!.id,
  epoch: room.timerEpoch,
});

/** Ends the turn by time, then the reveal: the next turn chosen at once, or FINAL. */
function playOut(room: Room): Room {
  const now = room.turn!.endsAt! + 100;
  const reveal = step(room, timer(room, 'drawUp'), now).room;
  const t = now + REVEAL_MS;
  const next = step(reveal, timer(reveal, 'revealDone'), t).room;
  return next.phase === 'CHOOSING' ? choose(next, t) : next;
}

/**
 * Ana, Ben and Cy, one cycle. Turn 1 (Ana draws): Ben wrong, close, then right 9 s in; Cy right
 * 20 s in. Turn 2 (Ben draws): nobody gets it. Turn 3 (Cy draws): Ana wrong three times.
 */
function playedGame() {
  const { room: start, pids, at } = started();
  const [ana, ben, cy] = pids as [string, string, string];
  let room: Room = { ...start, settings: { ...start.settings, cycles: 1 } };
  const word = secretWord(room);
  room = step(room, guess(ben, 'zzzz', at + 2_000), at + 2_000).room;
  room = step(room, guess(ben, `${word}q`, at + 4_000), at + 4_000).room;
  room = step(room, guess(ben, word, at + 9_000), at + 9_000).room;
  room = step(room, guess(cy, word, at + 20_000), at + 20_000).room;
  room = playOut(room);
  room = playOut(room);
  const t3 = room.turn!.clockStart!;
  for (const [i, text] of ['xx', 'yy', 'ww'].entries()) {
    room = step(room, guess(ana, text, t3 + 1_000 * (i + 1)), t3 + 1_000 * (i + 1)).room;
  }
  room = playOut(room);
  return { room, ana, ben, cy };
}

describe('the turn summary and FINAL', () => {
  it('TurnSummary records corrected times, close and wrong counts', () => {
    const { room, ana, ben, cy } = playedGame();
    const [t1, t2, t3] = room.history as [TurnSummary, TurnSummary, TurnSummary];
    // Corrected for the 40 ms one-way latency.
    expect(t1.correct).toEqual([
      { pid: ben, elapsedMs: 8_960 },
      { pid: cy, elapsedMs: 19_960 },
    ]);
    expect(t1.close).toEqual({ [ben]: 1 });
    expect(t1.wrong).toEqual({ [ben]: 1 });
    expect(t1.endReason).toBe('time');
    expect(t2).toMatchObject({ correct: [], close: {}, wrong: {} });
    expect(t3).toMatchObject({ correct: [], close: {}, wrong: { [ana]: 3 } });
  });

  it('entering FINAL at the end of the last cycle computes the awards', () => {
    const { room, ana, ben, cy } = playedGame();
    expect(room.phase).toBe('FINAL');
    // Ranked Ben, Ana (her drawer half), Cy. Cy (last) wins the tie on Sharpshooter; Ana takes
    // Picasso; Ben, fastest, takes Bilis. Malapit na, Most creative and Modern art are only for
    // players who already hold one, so they're skipped.
    expect(room.awards).toEqual([
      { kind: 'picasso', pid: ana },
      { kind: 'bilis', pid: ben },
      { kind: 'sharpshooter', pid: cy },
    ]);
    expect(room.awards).toEqual(computeAwards(Object.values(room.players), room.history));
  });

  it('End game computes them too, counting the turn it cut short', () => {
    const { room: start, pids, at } = started();
    const [, ben] = pids as [string, string, string];
    let room = step(start, guess(ben, 'zzzz', at + 1_000), at + 1_000).room;
    room = step(room, { type: 'host:end', by: SCREEN_HOST }, at + 3_000).room;
    expect(room.phase).toBe('FINAL');
    // Cut short with nobody right: no Modern art for the drawer, who wasn't given the time.
    expect(room.awards).toEqual([{ kind: 'mostCreative', pid: ben }]);
  });

  it('a rematch clears them, and the next FINAL computes its own', () => {
    const { room: final } = playedGame();
    const res = step(final, { type: 'host:rematch', by: SCREEN_HOST }, 9e6);
    const go = res.effects.find(
      (e): e is Extract<Effect, { type: 'schedule' }> => e.type === 'schedule',
    )!;
    const next = step(
      res.room,
      { type: 'timer', timer: go.timer, turnId: go.turnId, epoch: go.epoch },
      go.at,
    ).room;
    expect(next.phase).not.toBe('FINAL');
    expect(next.awards).toEqual([]);
    expect(step(next, { type: 'host:end', by: SCREEN_HOST }, go.at + 1).room.awards).toEqual([]);
  });

  it('the Screen sees every award; each phone only its own, and none before FINAL', () => {
    const { room, ana, ben, cy } = playedGame();
    const screen = toView(room, { kind: 'screen', isHost: false }, 0) as ScreenView;
    expect(screen.awards).toEqual(room.awards);
    for (const pid of [ana, ben, cy]) {
      const phone = toView(room, { kind: 'player', pid }, 0) as PlayerView;
      expect(phone.me.award).toEqual(room.awards.find((a) => a.pid === pid));
      for (const other of room.awards.filter((a) => a.pid !== pid)) {
        expect(JSON.stringify(phone)).not.toContain(`"kind":"${other.kind}"`);
      }
    }
    const before = { ...room, phase: 'REVEAL' as const };
    expect((toView(before, { kind: 'screen', isHost: false }, 0) as ScreenView).awards).toEqual([]);
    expect((toView(before, { kind: 'player', pid: ana }, 0) as PlayerView).me.award).toBeNull();
  });
});

// `host:settings` (F22): Settings and the Actions table in docs/spec.md. Presets are client-side.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, PRESETS } from '../shared/constants.js';
import type { Action, Phase, Room, RoomSettings, Sender } from '../shared/types.js';
import { reduce } from './reducer.js';
import { toView } from './views.js';
import {
  SCREEN,
  SCREEN_HOST,
  T0,
  asPlayer,
  dealt,
  makeRoom,
  started,
  step,
  withPlayers,
} from './test/rooms.js';

const settings = (s: Partial<RoomSettings>, by: Sender = SCREEN_HOST): Action => ({
  type: 'host:settings',
  by,
  ...s,
});

/**
 * The room in `phase`, reached by playing a 2-player game with the host's Skip and Next: one cycle
 * for FINAL, two to stop at the SCOREBOARD between them.
 */
function inPhase(phase: Exclude<Phase, 'LOBBY'>): Room {
  const base = makeRoom({
    settings: { ...DEFAULT_SETTINGS, cycles: phase === 'SCOREBOARD' ? 2 : 1 },
  });
  const { room, at } = dealt(['Ana', 'Ben'], base);
  const host = (r: Room, type: 'host:skip' | 'host:next', t: number) =>
    step(r, { type, by: SCREEN_HOST }, t).room;
  const pick = (r: Room, t: number) =>
    step(r, { type: 'drawer:choose', by: asPlayer(r.turn!.drawerPid), index: 0 }, t).room;
  if (phase === 'CHOOSING') return room;
  let r = pick(room, at);
  if (phase === 'DRAWING') return r;
  r = host(r, 'host:skip', at + 1000);
  if (phase === 'REVEAL') return r;
  // Turn 2 (Ben) was dealt at the reveal: take it up, choose if still open, and skip it.
  r = host(r, 'host:next', at + 2000);
  if (r.phase === 'CHOOSING') r = pick(r, at + 2500);
  r = host(host(r, 'host:skip', at + 3000), 'host:next', at + 4000);
  expect(r.phase).toBe(phase);
  return r;
}

describe('host:settings in LOBBY', () => {
  it('starts from the defaults (60 s drawing)', () => {
    expect(makeRoom().settings).toEqual(DEFAULT_SETTINGS);
    expect(makeRoom().settings.drawSeconds).toBe(60);
  });

  it('merges a partial: only the keys sent change', () => {
    const { room } = withPlayers(['Ana', 'Ben']);
    const res = step(room, settings({ drawSeconds: 100, spicy: true }), T0 + 10);
    expect(res.room.settings).toEqual({ ...DEFAULT_SETTINGS, drawSeconds: 100, spicy: true });
    expect(res.effects).toEqual([]);
  });

  it('accepts every allowed drawing time', () => {
    for (const drawSeconds of [45, 60, 80, 100] as const) {
      expect(step(makeRoom(), settings({ drawSeconds }), T0).room.settings.drawSeconds).toBe(
        drawSeconds,
      );
    }
  });

  it('applies every setting at once', () => {
    const all: RoomSettings = {
      drawSeconds: 45,
      cycles: 3,
      hints: false,
      difficulty: 'easy',
      words: 'taglish',
      spicy: true,
      guessFeed: 'off',
      copy: 'taglish',
      autoAdvance: false,
    };
    expect(step(makeRoom(), settings(all), T0).room.settings).toEqual(all);
  });

  it('applies each preset’s values (presets are just host:settings)', () => {
    for (const preset of Object.values(PRESETS)) {
      const room = step(
        makeRoom(),
        settings({ drawSeconds: 100, cycles: 3, hints: false }),
        T0,
      ).room;
      expect(step(room, settings(preset.settings), T0).room.settings).toEqual({
        ...DEFAULT_SETTINGS,
        ...preset.settings,
      });
    }
  });

  it('an empty payload is a no-op', () => {
    const room = makeRoom();
    expect(step(room, settings({}), T0).room.settings).toEqual(room.settings);
  });

  it('a later start uses the new settings (drawing time)', () => {
    const { room } = withPlayers(['Ana', 'Ben']);
    const set = step(room, settings({ drawSeconds: 45 }), T0 + 10).room;
    const dealtRoom = step(set, { type: 'host:start', by: SCREEN_HOST }, T0 + 1000).room;
    const drawing = step(
      dealtRoom,
      { type: 'drawer:choose', by: asPlayer(dealtRoom.turn!.drawerPid), index: 0 },
      T0 + 2000,
    ).room;
    expect(drawing.turn!.endsAt).toBe(T0 + 2000 + 45_000);
  });

  it('the crown holder’s phone may change settings', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    const res = step(room, settings({ cycles: 1 }, asPlayer(pids[0]!, true)), T0 + 10);
    expect(res.room.settings.cycles).toBe(1);
  });

  it('refuses a non-host: a Screen without the token, or a player', () => {
    const { room, pids } = withPlayers(['Ana', 'Ben']);
    expect(reduce(room, settings({ cycles: 1 }, SCREEN), T0)).toEqual({
      ok: false,
      error: 'notHost',
    });
    expect(reduce(room, settings({ cycles: 1 }, asPlayer(pids[1]!)), T0)).toEqual({
      ok: false,
      error: 'notHost',
    });
    // A stale isHost on a player who no longer holds the crown.
    expect(reduce(room, settings({ cycles: 1 }, asPlayer(pids[1]!, true)), T0)).toEqual({
      ok: false,
      error: 'notHost',
    });
  });
});

describe('host:settings mid-game: only guessFeed', () => {
  const phases = ['CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD', 'FINAL'] as const;

  it.each(phases)('changes guessFeed in %s', (phase) => {
    const room = inPhase(phase);
    expect(room.phase).toBe(phase);
    const res = step(room, settings({ guessFeed: 'clean' }), T0 + 60_000);
    expect(res.room.settings).toEqual({ ...room.settings, guessFeed: 'clean' });
    // No phase change, no timer touched.
    expect(res.room.phase).toBe(phase);
    expect(res.room.timerEpoch).toBe(room.timerEpoch);
    expect(res.effects).toEqual([]);
  });

  it.each(phases)('refuses any lobby-only setting in %s, the whole payload', (phase) => {
    const room = inPhase(phase);
    for (const s of [
      { drawSeconds: 45 },
      { cycles: 3 },
      { hints: false },
      { difficulty: 'easy' },
      { words: 'en' },
      { spicy: true },
      { copy: 'taglish' },
      { autoAdvance: false },
      { guessFeed: 'off', drawSeconds: 100 }, // one lobby-only key refuses the whole payload
    ] as Partial<RoomSettings>[]) {
      expect(reduce(room, settings(s), T0 + 60_000)).toEqual({ ok: false, error: 'wrongPhase' });
    }
  });

  it('refuses a non-host mid-game too', () => {
    const { room, pids } = started(['Ana', 'Ben']);
    expect(reduce(room, settings({ guessFeed: 'off' }, asPlayer(pids[1]!)), T0)).toEqual({
      ok: false,
      error: 'notHost',
    });
  });

  it('a mid-turn switch to clean masks a feed guess already shown, and off empties the feed', () => {
    const { room, pids, at } = started(['Ana', 'Ben']);
    const guesser = pids.find((p) => p !== room.turn!.drawerPid)!;
    const guessed = step(
      room,
      {
        type: 'player:guess',
        by: asPlayer(guesser),
        text: 'shit',
        receivedAt: at + 3000,
        oneWayMs: 0,
      },
      at + 3000,
    ).room;
    const feed = (r: Room) => toView(r, { kind: 'screen', isHost: false }, at + 4000).feed;
    expect(feed(guessed)).toEqual([{ pid: guesser, text: 'shit' }]);
    const clean = step(guessed, settings({ guessFeed: 'clean' }), at + 4000).room;
    expect(feed(clean)).toEqual([{ pid: guesser, text: null }]);
    const off = step(clean, settings({ guessFeed: 'off' }), at + 4000).room;
    expect(feed(off)).toEqual([]);
  });
});

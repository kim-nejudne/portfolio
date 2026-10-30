import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, OWN_GUESSES_SHOWN } from '../../../shared/constants.js';
import type { PlayerView } from '../../../shared/types.js';
import {
  addOwnGuess,
  createPointerGate,
  DRAWER_BAR_PX,
  DRAWER_TOOL_ROW_PX,
  drawerPadSize,
  drawerSideways,
  gainedCrown,
  guessAnswer,
  joinOutcome,
} from './phone.js';

describe('drawerPadSize', () => {
  it.each([
    // [width, height, pad]: the spec's three phones.
    [360, 560, 352],
    [390, 664, 382],
    [412, 780, 404],
  ])('at %i × %i the pad is %i px and bar + pad + two rows fit the height', (w, h, pad) => {
    expect(drawerPadSize(w, h)).toBe(pad);
    expect(DRAWER_BAR_PX + pad + 2 * DRAWER_TOOL_ROW_PX).toBeLessThanOrEqual(h);
    expect(pad).toBeLessThanOrEqual(w);
  });

  it('is limited by the height on a short, wide viewport', () => {
    expect(drawerPadSize(412, 400)).toBe(400 - 56 - 96 - 16);
  });

  it('floors fractional viewports and never goes negative', () => {
    expect(drawerPadSize(360.6, 900)).toBe(352);
    expect(drawerPadSize(100, 100)).toBe(0);
  });
});

describe('drawerSideways', () => {
  it.each([
    // A phone turned on its side: the pad would be smaller than at the 360 × 560 minimum.
    [844, 390],
    [780, 412],
    [932, 430],
    [640, 360],
  ])('asks to turn upright at %i × %i', (w, h) => {
    expect(drawerSideways(w, h)).toBe(true);
  });

  it.each([
    // Upright phones, the minimum included, and a landscape tablet whose pad still fits.
    [360, 560],
    [390, 664],
    [412, 780],
    [1180, 820],
    [1024, 768],
  ])('keeps the pad at %i × %i', (w, h) => {
    expect(drawerSideways(w, h)).toBe(false);
  });

  it('never asks in portrait, even on a viewport below the minimum', () => {
    expect(drawerSideways(320, 480)).toBe(false);
    expect(drawerSideways(400, 400)).toBe(false);
  });

  it('asks once a landscape pad drops below the 360 × 560 pad (352 px)', () => {
    expect(drawerSideways(900, 352 + 168)).toBe(false);
    expect(drawerSideways(900, 351 + 168)).toBe(true);
  });
});

describe('joinOutcome', () => {
  it('a stored key that is accepted (or a late alreadyJoined) goes straight in, no name step', () => {
    expect(joinOutcome({ ok: true })).toEqual({ status: 'live' });
    expect(joinOutcome({ ok: false, error: 'alreadyJoined' })).toEqual({ status: 'live' });
  });

  it('a missing room ends the page and a kick says so', () => {
    expect(joinOutcome({ ok: false, error: 'roomNotFound' })).toEqual({ status: 'ended' });
    expect(joinOutcome({ ok: false, error: 'kicked' })).toEqual({ status: 'removed' });
  });

  it('a taken name or a full room goes back to the name step with its message', () => {
    expect(joinOutcome({ ok: false, error: 'nameTaken' })).toEqual({
      status: 'form',
      error: 'nameTaken',
    });
    expect(joinOutcome({ ok: false, error: 'nameOfDisconnected' })).toEqual({
      status: 'form',
      error: 'nameTaken',
    });
    expect(joinOutcome({ ok: false, error: 'roomFull' })).toEqual({
      status: 'form',
      error: 'roomFull',
    });
    expect(joinOutcome({ ok: false, error: 'invalidPayload' })).toEqual({
      status: 'form',
      error: 'joinFailed',
    });
  });
});

describe('createPointerGate', () => {
  it('lets only the first pointer draw; a second finger is ignored until the first lifts', () => {
    const gate = createPointerGate();
    expect(gate.down(1)).toBe(true);
    expect(gate.down(2)).toBe(false);
    expect(gate.owns(2)).toBe(false);
    expect(gate.up(2)).toBe(false);
    expect(gate.owns(1)).toBe(true);
    expect(gate.up(1)).toBe(true);
    expect(gate.down(2)).toBe(true);
  });

  it('a pointercancel ends the stroke like a lift, and only once', () => {
    const gate = createPointerGate();
    gate.down(7);
    expect(gate.up(7)).toBe(true);
    expect(gate.up(7)).toBe(false);
    expect(gate.owns(7)).toBe(false);
  });
});

describe('guessAnswer', () => {
  it('says "Slow down" and puts the guess back after a slowDown refusal', () => {
    expect(guessAnswer({ ok: false, error: 'slowDown' })).toEqual({
      notice: 'slowDown',
      restore: true,
    });
  });

  it('leaves the box alone for an accepted guess, other refusals and a lost answer', () => {
    for (const res of [
      { ok: true } as const,
      { ok: false, error: 'tooLate' } as const,
      { ok: false, error: 'alreadyGuessed' } as const,
      { ok: false, error: 'emptyGuess' } as const,
      null,
    ])
      expect(guessAnswer(res)).toEqual({ notice: null, restore: false });
  });
});

describe('addOwnGuess', () => {
  const wrong = (text: string) => ({ text, close: false });

  it('keeps wrong and close guesses in order for the turn', () => {
    let list = addOwnGuess({ turnId: -1, items: [] }, 4, wrong('payong'));
    list = addOwnGuess(list, 4, { text: 'tsinelas ko', close: true });
    expect(list).toEqual({
      turnId: 4,
      items: [wrong('payong'), { text: 'tsinelas ko', close: true }],
    });
  });

  it('starts again on a new turn', () => {
    const list = addOwnGuess({ turnId: 4, items: [wrong('payong')] }, 5, wrong('bahay'));
    expect(list).toEqual({ turnId: 5, items: [wrong('bahay')] });
  });

  it(`keeps the last ${OWN_GUESSES_SHOWN}`, () => {
    let list = { turnId: 1, items: [] as { text: string; close: boolean }[] };
    for (let i = 0; i < OWN_GUESSES_SHOWN + 2; i++) list = addOwnGuess(list, 1, wrong(`g${i}`));
    expect(list.items.map((g) => g.text)).toEqual(['g2', 'g3', 'g4', 'g5', 'g6']);
  });
});

describe('gainedCrown (F25)', () => {
  const v = (pid: string, host: boolean): PlayerView => ({
    role: 'player',
    code: 'KPRW',
    phase: 'DRAWING',
    paused: null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 1,
    settings: { ...DEFAULT_SETTINGS },
    players: [],
    turn: null,
    host: host ? { code: 'KPRW', customWordCount: 0 } : null,
    me: { pid, turnPoints: 0, score: null, rank: null, award: null },
    secret: null,
    lastGuess: null,
  });

  it('is true when a view brings the crown the one before didn’t have', () => {
    expect(gainedCrown(v('jun', false), v('jun', true))).toBe(true);
  });

  it('is false on the first view, while keeping it, on losing it, and for another player', () => {
    expect(gainedCrown(null, v('jun', true))).toBe(false);
    expect(gainedCrown(v('jun', true), v('jun', true))).toBe(false);
    expect(gainedCrown(v('jun', true), v('jun', false))).toBe(false);
    expect(gainedCrown(v('ana', false), v('jun', true))).toBe(false);
  });
});

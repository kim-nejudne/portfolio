import { describe, expect, it } from 'vitest';
import {
  createPointerGate,
  DRAWER_BAR_PX,
  DRAWER_TOOL_ROW_PX,
  drawerPadSize,
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

// The lobby doodle stays on the phone (F55): drawn, capped and undone locally, with no socket.
import { describe, expect, it } from 'vitest';
import { createInkStack, stackOps, visibleStrokes } from '../../../shared/ink.js';
import { DOODLE_MAX_BYTES, createPhoneDoodle, loadDoodle, saveDoodle } from './doodle.js';

/** Draws a stroke through `points` (grid pairs) and lifts the finger. */
function draw(doodle: ReturnType<typeof createPhoneDoodle>, points: number[]) {
  const stroke = doodle.begin(0, 1, points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) stroke.points.push(points[i]!, points[i + 1]!);
  return doodle.end(stroke);
}

/** A zigzag RDP can't thin: `n` points far apart. */
const zigzag = (n: number, y = 0) =>
  Array.from({ length: n }, (_, i) => [i * 6, y + (i % 2) * 300]).flat();

function memoryStore() {
  const items = new Map<string, string>();
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
  };
}

describe('the phone doodle', () => {
  it('draws with no socket at all: a finished stroke stays on the pad, simplified', () => {
    const doodle = createPhoneDoodle([]);
    const stroke = doodle.begin(0, 1, 100, 100);
    for (let x = 101; x < 400; x++) stroke.points.push(x, 100 + (x % 2));
    expect(doodle.end(stroke)).toBe('ok');
    expect(visibleStrokes(doodle.stack)).toHaveLength(1);
    expect(stackOps(doodle.stack)[0]).toEqual(['b', 1, 0, 1, 100, 100]);
    // RDP kept far fewer than the 300 raw points.
    expect(stroke.points.length / 2).toBeLessThan(20);
  });

  it(`takes a stroke off again when the doodle would pass ${DOODLE_MAX_BYTES / 1024} KB, and says it is full`, () => {
    const doodle = createPhoneDoodle([], 400);
    expect(draw(doodle, zigzag(20))).toBe('ok');
    expect(draw(doodle, zigzag(40, 10))).toBe('full');
    expect(visibleStrokes(doodle.stack).map((s) => s.id)).toEqual([1]);
    expect(JSON.stringify(stackOps(doodle.stack)).length).toBeLessThanOrEqual(400);
    // A smaller stroke still fits.
    expect(draw(doodle, [5, 5, 9, 9])).toBe('ok');
  });

  it('makes room again with Undo', () => {
    const doodle = createPhoneDoodle([], 400);
    draw(doodle, zigzag(40));
    expect(draw(doodle, zigzag(40, 5))).toBe('full');
    expect(doodle.undo()).toBe(true);
    expect(visibleStrokes(doodle.stack)).toEqual([]);
    expect(draw(doodle, zigzag(40, 5))).toBe('ok');
  });

  it('caps at 20 KB by default', () => {
    expect(DOODLE_MAX_BYTES).toBe(20 * 1024);
    const doodle = createPhoneDoodle([]);
    let result = 'ok';
    for (let i = 0; i < 200 && result === 'ok'; i++) result = draw(doodle, zigzag(150, i));
    expect(result).toBe('full');
    expect(JSON.stringify(stackOps(doodle.stack)).length).toBeLessThanOrEqual(DOODLE_MAX_BYTES);
  });

  it('undoes the last stroke, and never with a stroke in hand or nothing to undo', () => {
    const doodle = createPhoneDoodle([]);
    expect(doodle.canUndo()).toBe(false);
    expect(doodle.undo()).toBe(false);
    draw(doodle, [10, 10, 50, 50]);
    draw(doodle, [20, 20, 60, 60]);
    const stroke = doodle.begin(0, 1, 30, 30);
    expect(doodle.canUndo()).toBe(false);
    expect(doodle.undo()).toBe(false);
    doodle.end(stroke);
    expect(doodle.undo()).toBe(true);
    expect(visibleStrokes(doodle.stack).map((s) => s.id)).toEqual([1, 2]);
  });

  it('continues a saved doodle after a reload, with strokeIds after the saved ones', () => {
    const first = createPhoneDoodle([]);
    draw(first, [10, 10, 50, 50]);
    draw(first, [20, 20, 60, 60]);
    const store = memoryStore();
    saveDoodle('k', first.stack, store);

    const again = createPhoneDoodle(loadDoodle('k', store));
    expect(stackOps(again.stack)).toEqual(stackOps(first.stack));
    draw(again, [30, 30, 70, 70]);
    expect(visibleStrokes(again.stack).map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it('loads nothing from a missing or broken entry, or without storage', () => {
    const store = memoryStore();
    expect(loadDoodle('none', store)).toEqual([]);
    store.setItem('none', '{oops');
    expect(loadDoodle('none', store)).toEqual([]);
    store.setItem('none', JSON.stringify([['x', 1]]));
    expect(loadDoodle('none', store)).toEqual([]);
    expect(loadDoodle('none', null)).toEqual([]);
    expect(() => saveDoodle('none', createInkStack(), null)).not.toThrow();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyInkOps, createInkStack, stackOps, visibleStrokes } from '../../../shared/ink.js';
import type { Ack, InkOp } from '../../../shared/types.js';
import { createPhoneDoodle, loadDoodle, saveDoodle } from './doodle.js';

/** A send that records each batch and answers with the next queued ack (ok by default). */
function fakeSend(...answers: (Ack | null)[]) {
  const sent: InkOp[][] = [];
  const send = (ops: InkOp[]) => {
    sent.push(ops);
    return Promise.resolve<Ack | null>(answers.length > 0 ? answers.shift()! : { ok: true });
  };
  return { sent, send };
}

/** Draws a stroke through `points` (grid pairs) and lifts the finger. */
function draw(doodle: ReturnType<typeof createPhoneDoodle>, points: number[]) {
  const stroke = doodle.begin(0, 1, points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) stroke.points.push(points[i]!, points[i + 1]!);
  return doodle.end(stroke);
}

afterEach(() => {
  vi.useRealTimers();
});

function memoryStore() {
  const items = new Map<string, string>();
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  };
}

describe('the phone doodle', () => {
  it('sends nothing while the finger moves, then one batch at stroke end: the stroke as the server will hold it', async () => {
    vi.useFakeTimers();
    const { sent, send } = fakeSend();
    const doodle = createPhoneDoodle([], send);
    const stroke = doodle.begin(0, 1, 100, 100);
    for (let x = 101; x < 400; x++) stroke.points.push(x, 100 + (x % 2));
    vi.advanceTimersByTime(1000);
    expect(sent).toEqual([]);
    expect(await doodle.end(stroke)).toBe('ok');
    expect(sent).toHaveLength(1);
    // The local line is simplified to what was sent, so the pad and the Screen agree.
    const server = createInkStack();
    applyInkOps(server, sent[0]!);
    expect(stackOps(server)).toEqual(stackOps(doodle.stack));
    expect(sent[0]![0]).toEqual(['b', 1, 0, 1, 100, 100]);
    expect(sent[0]!.at(-1)).toEqual(['e', 1]);
    // RDP kept far fewer than the 300 raw points.
    expect(stroke.points.length / 2).toBeLessThan(20);
  });

  it('drops a stroke the server refused (a full doodle, the game started) and says why', async () => {
    const { send } = fakeSend(
      { ok: true },
      { ok: false, error: 'inkFull' },
      { ok: false, error: 'wrongPhase' },
    );
    const doodle = createPhoneDoodle([], send);
    expect(await draw(doodle, [10, 10, 50, 50])).toBe('ok');
    expect(await draw(doodle, [60, 60, 90, 90])).toBe('full');
    expect(await draw(doodle, [70, 70, 95, 95])).toBe('refused');
    expect(visibleStrokes(doodle.stack).map((s) => s.points.slice(0, 2))).toEqual([[10, 10]]);
  });

  it('keeps a stroke that got no answer (timeout): the server most likely has it', async () => {
    const doodle = createPhoneDoodle([], fakeSend(null).send);
    expect(await draw(doodle, [10, 10, 50, 50])).toBe('ok');
    expect(visibleStrokes(doodle.stack)).toHaveLength(1);
  });

  it('undoes the last stroke and sends one undo; a refused undo puts it back', async () => {
    const { sent, send } = fakeSend(
      { ok: true },
      { ok: true },
      { ok: true },
      {
        ok: false,
        error: 'wrongPhase',
      },
    );
    const doodle = createPhoneDoodle([], send);
    expect(doodle.canUndo()).toBe(false);
    expect(doodle.undo()).toBeNull();
    await draw(doodle, [10, 10, 50, 50]);
    await draw(doodle, [20, 20, 60, 60]);
    expect(await doodle.undo()).toBe('ok');
    expect(sent.at(-1)).toEqual([['u']]);
    expect(visibleStrokes(doodle.stack).map((s) => s.id)).toEqual([1]);
    expect(await doodle.undo()).toBe('refused');
    expect(visibleStrokes(doodle.stack).map((s) => s.id)).toEqual([1]);
  });

  it('never undoes with a stroke in hand or a send unanswered, so the server undoes the same stroke', async () => {
    let answer: (a: Ack) => void = () => {};
    const sent: InkOp[][] = [];
    const doodle = createPhoneDoodle([], (ops) => {
      sent.push(ops);
      return new Promise<Ack>((resolve) => (answer = resolve));
    });
    const stroke = doodle.begin(0, 1, 10, 10);
    expect(doodle.undo()).toBeNull();
    const ended = doodle.end(stroke);
    expect(doodle.canUndo()).toBe(false);
    expect(doodle.undo()).toBeNull();
    answer({ ok: true });
    await ended;
    expect(doodle.canUndo()).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it('continues a saved doodle after a reload, with strokeIds after the saved ones', async () => {
    const first = createPhoneDoodle([], fakeSend().send);
    await draw(first, [10, 10, 50, 50]);
    await draw(first, [20, 20, 60, 60]);
    const store = memoryStore();
    saveDoodle('k', first.stack, store);

    const { sent, send } = fakeSend();
    const again = createPhoneDoodle(loadDoodle('k', store), send);
    expect(stackOps(again.stack)).toEqual(stackOps(first.stack));
    await draw(again, [30, 30, 70, 70]);
    expect(sent[0]![0]).toEqual(['b', 3, 0, 1, 30, 30]);
    expect(visibleStrokes(again.stack)).toHaveLength(3);
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

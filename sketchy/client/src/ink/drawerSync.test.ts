import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INK_DRAWER_RETRY_MS, INK_RESEND_BURST } from '../../../shared/constants.js';
import { applyInkOps, createInkStack, pushStroke, stackOps } from '../../../shared/ink.js';
import type { Ack, InkBatch, InkClientPayloads, InkOp } from '../../../shared/types.js';
import { createDrawerSync, maxStrokeId, mergeSnapshot } from './drawerSync.js';
import { createInkSender } from './inkSender.js';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const T = 7;

/** The server's side, as `inkStore` does it: in-order batches only, duplicates ignored. */
function fakeServer(initial: InkOp[] = [], initialSeq = 0) {
  const stack = createInkStack();
  applyInkOps(stack, initial);
  let lastSeq = initialSeq;
  const applied: number[] = [];
  const gaps: number[] = [];
  return {
    stack,
    applied,
    gaps,
    lastSeq: () => lastSeq,
    receive([, seq, ops]: InkBatch) {
      if (seq <= lastSeq) return;
      if (seq > lastSeq + 1) return void gaps.push(lastSeq + 1);
      lastSeq = seq;
      applied.push(seq);
      applyInkOps(stack, ops);
    },
  };
}

type Server = ReturnType<typeof fakeServer>;

/** A drawer: its held sender, its sync, a link that may be up or down, and what it emitted. */
function drawer(server: Server) {
  const link = { up: false };
  const emitted: [string, unknown][] = [];
  // The ack of each hello and sync, answered by the test (null = timed out).
  const acks: ((res: Ack | null) => void)[] = [];
  const pad = createInkStack();
  const sender = createInkSender({
    turnId: T,
    held: true,
    send: (b) => {
      if (link.up) server.receive(b);
    },
  });
  const sync = createDrawerSync({
    code: 'ABCD',
    turnId: T,
    sender,
    emit: <E extends 'ink:hello' | 'ink:sync'>(
      event: E,
      payload: InkClientPayloads[E],
      onAck: (res: Ack | null) => void,
    ) => {
      emitted.push([event, payload]);
      acks.push(onAck);
    },
    onSnapshot: (snap, offset) => mergeSnapshot(pad, snap.actions, offset),
  });
  /** Draws a short stroke on the pad and through the sender, as `DrawPad` does. */
  const draw = (x: number) => {
    const id = sender.begin(0, 1, x, 100);
    const stroke = pushStroke(pad, id, 0, 1, x, 100);
    for (const dx of [10, 20, 30]) {
      stroke.points.push(x + dx, 100 + dx);
      sender.move(x + dx, 100 + dx);
    }
    stroke.ended = true;
    sender.end();
  };
  const connect = () => {
    link.up = true;
    sync.connected();
  };
  const drop = () => {
    link.up = false;
    sync.disconnected();
  };
  return { link, emitted, acks, pad, sender, sync, draw, connect, drop };
}

describe('drawerSync', () => {
  it('on a fresh turn, says hello and sends nothing until its (empty) snapshot arrives', () => {
    const server = fakeServer();
    const d = drawer(server);
    d.connect();
    expect(d.emitted).toEqual([['ink:hello', { code: 'ABCD' }]]);
    d.draw(100);
    expect(server.applied).toEqual([]);
    d.sync.snapshot({ turnId: T, seq: 0, actions: [] });
    expect(server.applied).toEqual([1]);
    expect(server.stack.actions).toEqual(d.pad.actions);
  });

  it('after a reload, continues its own drawing from the snapshot, after its seq and strokeIds', () => {
    const before: InkOp[] = [
      ['b', 1, 0, 1, 10, 10],
      ['p', 1, 5, 5],
      ['e', 1],
      ['c'],
      ['b', 3, 2, 1, 40, 40],
      ['e', 3],
    ];
    const server = fakeServer(before, 5);
    const d = drawer(server);
    d.connect();
    // The finger lands before the snapshot is back: the stroke waits, then is renumbered.
    d.draw(200);
    d.sync.snapshot({ turnId: T, seq: 5, actions: stackOps(server.stack) });
    expect(server.applied).toEqual([6]);
    expect(d.pad.actions).toEqual(server.stack.actions);
    expect(d.pad.actions.at(-1)).toMatchObject({ kind: 'stroke', stroke: { id: 4 } });
    // The next stroke goes on from there.
    d.draw(300);
    expect(server.applied).toEqual([6, 7]);
    expect(d.pad.actions).toEqual(server.stack.actions);
    // A later snapshot (another hello) is ignored once started.
    d.sync.snapshot({ turnId: T, seq: 0, actions: [] });
    expect(d.pad.actions).toEqual(server.stack.actions);
  });

  it('a brief drop: syncs, resends only what the server is missing, then the pending ops, without duplicates', () => {
    const server = fakeServer();
    const d = drawer(server);
    d.connect();
    d.sync.snapshot({ turnId: T, seq: 0, actions: [] });
    d.draw(100);
    d.draw(200);
    expect(server.applied).toEqual([1, 2]);

    // Batch 3 is lost on the way: the socket was already dead, and only then noticed.
    d.link.up = false;
    d.draw(300);
    d.drop();
    // Drawn while disconnected: kept pending, not numbered.
    d.draw(400);
    d.draw(500);
    expect(d.sender.lastSeq()).toBe(3);

    d.connect();
    expect(d.emitted.at(-1)).toEqual(['ink:sync', { turnId: T, lastSentSeq: 3 }]);
    expect(server.applied).toEqual([1, 2]); // pending waits for the answer
    d.sync.state({ turnId: T, lastSeq: server.lastSeq() });
    // Batch 3 again, then the two strokes drawn offline in one batch.
    expect(server.applied).toEqual([1, 2, 3, 4]);
    expect(server.gaps).toEqual([]);
    expect(server.stack.actions).toEqual(d.pad.actions);
  });

  it('answers ink:resend by sending the kept batches from there, unchanged', () => {
    const server = fakeServer();
    const d = drawer(server);
    d.connect();
    d.sync.snapshot({ turnId: T, seq: 0, actions: [] });
    d.draw(100);
    d.link.up = false; // batch 2 lost (a refused batch looks the same)
    d.draw(200);
    d.link.up = true;
    d.draw(300);
    expect(server.gaps).toEqual([2]);
    d.sync.resend({ turnId: T, from: 2 });
    d.sync.resend({ turnId: T, from: 2 }); // a second ask only sends duplicates, ignored
    expect(server.applied).toEqual([1, 2, 3]);
    expect(server.stack.actions).toEqual(d.pad.actions);
    expect(d.sender.kept().map((b) => b[1])).toEqual([1, 2, 3]);
  });

  it('ignores state, resend and snapshots for another turn', () => {
    const server = fakeServer();
    const d = drawer(server);
    d.connect();
    d.sync.snapshot({ turnId: T + 1, seq: 9, actions: [['c']] });
    expect(d.sender.started()).toBe(false);
    d.sync.snapshot({ turnId: T, seq: 0, actions: [] });
    d.draw(100);
    d.sync.resend({ turnId: T - 1, from: 1 });
    d.sync.state({ turnId: T - 1, lastSeq: 0 });
    expect(server.applied).toEqual([1]);
  });

  it('says hello again on a reconnect before its snapshot ever arrived', () => {
    const server = fakeServer();
    const d = drawer(server);
    d.connect();
    d.drop();
    d.connect();
    expect(d.emitted.map(([e]) => e)).toEqual(['ink:hello', 'ink:hello']);
    d.sync.snapshot({ turnId: T, seq: 0, actions: [] });
    d.draw(100);
    expect(server.applied).toEqual([1]);
  });
});

describe('drawerSync retries', () => {
  it('asks hello again when it is answered without a snapshot or not at all, until one comes', () => {
    const server = fakeServer();
    const d = drawer(server);
    d.connect();
    d.acks.at(-1)!({ ok: true }); // answered, no snapshot (it would have come first)
    vi.advanceTimersByTime(INK_DRAWER_RETRY_MS);
    expect(d.emitted.map(([e]) => e)).toEqual(['ink:hello', 'ink:hello']);
    d.acks.at(-1)!(null); // timed out
    vi.advanceTimersByTime(INK_DRAWER_RETRY_MS);
    expect(d.emitted).toHaveLength(3);
    d.sync.snapshot({ turnId: T, seq: 0, actions: [] });
    d.acks.at(-1)!({ ok: true });
    vi.advanceTimersByTime(INK_DRAWER_RETRY_MS * 3);
    expect(d.emitted).toHaveLength(3);
  });

  it('asks sync again when it got no answer', () => {
    const server = fakeServer();
    const d = drawer(server);
    d.connect();
    d.sync.snapshot({ turnId: T, seq: 0, actions: [] });
    d.drop();
    d.connect();
    d.acks.at(-1)!(null);
    vi.advanceTimersByTime(INK_DRAWER_RETRY_MS);
    expect(d.emitted.map(([e]) => e)).toEqual(['ink:hello', 'ink:sync', 'ink:sync']);
  });

  it(`resends ${INK_RESEND_BURST} batches at a time, syncing again for the rest`, () => {
    const server = fakeServer();
    const d = drawer(server);
    d.connect();
    d.sync.snapshot({ turnId: T, seq: 0, actions: [] });
    d.link.up = false; // a dead socket not yet noticed: 70 batches lost
    for (let i = 0; i < 70; i++) d.draw(i);
    d.drop();
    d.connect();
    d.draw(900); // pending until everything missing has gone out
    d.sync.state({ turnId: T, lastSeq: server.lastSeq() });
    expect(server.applied).toHaveLength(INK_RESEND_BURST);
    vi.advanceTimersByTime(INK_DRAWER_RETRY_MS);
    expect(d.emitted.at(-1)).toEqual(['ink:sync', { turnId: T, lastSentSeq: 70 }]);
    d.sync.state({ turnId: T, lastSeq: server.lastSeq() });
    vi.advanceTimersByTime(INK_DRAWER_RETRY_MS);
    d.sync.state({ turnId: T, lastSeq: server.lastSeq() });
    expect(server.applied).toEqual(Array.from({ length: 71 }, (_, i) => i + 1));
    expect(server.gaps).toEqual([]);
    expect(server.stack.actions).toEqual(d.pad.actions);
  });

  it('a rate-limited batch is recovered by a sync after a moment', () => {
    const server = fakeServer();
    const d = drawer(server);
    d.connect();
    d.sync.snapshot({ turnId: T, seq: 0, actions: [] });
    d.draw(100);
    d.link.up = false; // as if refused
    d.draw(200);
    d.link.up = true;
    d.sync.batchAck({ ok: false, error: 'rateLimited' });
    d.sync.batchAck({ ok: false, error: 'rateLimited' });
    vi.advanceTimersByTime(INK_DRAWER_RETRY_MS);
    expect(d.emitted.filter(([e]) => e === 'ink:sync')).toHaveLength(1);
    d.sync.state({ turnId: T, lastSeq: server.lastSeq() });
    expect(server.applied).toEqual([1, 2]);
    expect(server.stack.actions).toEqual(d.pad.actions);
  });

  it('stops retrying once disposed', () => {
    const d = drawer(fakeServer());
    d.connect();
    d.acks.at(-1)!({ ok: true });
    d.sync.dispose();
    vi.advanceTimersByTime(INK_DRAWER_RETRY_MS * 3);
    expect(d.emitted).toHaveLength(1);
  });
});

describe('maxStrokeId and mergeSnapshot', () => {
  it('finds the largest begun strokeId', () => {
    expect(maxStrokeId([])).toBe(0);
    expect(maxStrokeId([['b', 4, 0, 1, 0, 0], ['u'], ['b', 2, 0, 1, 0, 0], ['p', 9, 1, 1]])).toBe(
      4,
    );
  });

  it('puts the snapshot under the pad strokes, moving their ids up', () => {
    const pad = createInkStack();
    pushStroke(pad, 1, 3, 2, 500, 500);
    mergeSnapshot(pad, [['b', 1, 0, 1, 10, 10], ['e', 1], ['c']], 1);
    expect(pad.actions.map((a) => (a.kind === 'clear' ? 'c' : a.stroke.id))).toEqual([1, 'c', 2]);
    expect(pad.byId.get(2)?.points).toEqual([500, 500]);
    expect(pad.byId.get(1)?.points).toEqual([10, 10]);
  });
});

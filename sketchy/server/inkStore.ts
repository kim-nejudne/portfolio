// The InkStore: each room's ink logs, outside the reducer and in memory (Drawing data protocol,
// "Server relay and ink log"). A room has its latest turn's log, live until `close` freezes it, and
// the frozen logs it still keeps for the gallery.
//
// A live log takes batches in `seq` order only: a duplicate is ignored, and a batch after a gap is
// dropped so the drawer resends the missing ones. Each op is applied to the turn's action stack
// (`shared/ink.ts`, the drawer's and the Screen's code) within two caps on the stack's encoded
// size: the soft `turnMax` on the visible picture (ops after the last clear), past which new
// strokes are refused ("Canvas full"), and the hard `hardMax` on the whole stack (strokes under
// clears too), past which nothing but undo grows or changes it. Refused ops are left out of the
// batch the gateway relays, so every Screen rebuilds the store's stack exactly.
//
// Pure data and functions of their inputs: the gateway passes a monotonic `now` for resend asks.

import {
  INK_ACTION_OVERHEAD_BYTES,
  INK_RESEND_ASK_MS,
  INK_ROOM_MAX_BYTES,
  INK_TURN_HARD_MAX_BYTES,
  INK_TURN_MAX_ACTIONS,
  INK_TURN_MAX_BYTES,
} from '../shared/constants.js';
import {
  applyInkOps,
  createInkStack,
  stackOps,
  type InkStack,
  type InkStroke,
} from '../shared/ink.js';
import type { InkBatch, InkOp, InkSnapshot } from '../shared/types.js';

export interface InkStoreLimits {
  /** The visible picture's encoded bytes past which new strokes are refused. */
  turnMax: number;
  /** The whole stack's encoded bytes it never passes. */
  hardMax: number;
  /** Strokes and clears on the stack it never passes. */
  maxActions: number;
  /** Frozen logs a room keeps (encoded bytes plus an overhead per action); oldest dropped past it. */
  roomMax: number;
  /** The same gap is asked for again at most this often (ms). */
  resendAskMs: number;
}

const DEFAULT_LIMITS: InkStoreLimits = {
  turnMax: INK_TURN_MAX_BYTES,
  hardMax: INK_TURN_HARD_MAX_BYTES,
  maxActions: INK_TURN_MAX_ACTIONS,
  roomMax: INK_ROOM_MAX_BYTES,
  resendAskMs: INK_RESEND_ASK_MS,
};

/** One turn's ink log. */
export interface TurnLog {
  turnId: number;
  stack: InkStack;
  /** The last `seq` applied; 0 before the first batch. */
  lastSeq: number;
  frozen: boolean;
  /** Encoded bytes of everything on the stack, strokes under clears included. */
  bytes: number;
  /** `bytes` just after each clear still on the stack was pushed, oldest first. */
  clearMarks: number[];
  /** Encoded bytes of each stroke on the stack (its `b` and `p` ops). */
  strokeBytes: Map<InkStroke, number>;
  /** The gap last asked for (its `from`) and when, so a burst of batches asks once. */
  asked: { from: number; at: number } | null;
}

/** Encoded bytes of the visible picture: the ops after the last clear on the stack. */
export function visibleBytes(log: TurnLog): number {
  return log.bytes - (log.clearMarks[log.clearMarks.length - 1] ?? 0);
}

export type BatchOutcome =
  /** Applied. `relay` is the batch without refused ops (the same array when none were); `full`
   * says the canvas refused some. The batch's `seq` is taken either way. */
  | { kind: 'applied'; relay: InkBatch; full: boolean }
  /** `seq` already applied: ignored. */
  | { kind: 'duplicate' }
  /** A `seq` is missing before this one: dropped. `ask` says to send `ink:resend {from}` now. */
  | { kind: 'gap'; from: number; ask: boolean }
  /** The turn is frozen, or older than the room's latest. */
  | { kind: 'closed' };

export interface InkStore {
  /** Starts a turn's live log (freezing a live one left open). */
  open(code: string, turnId: number): void;
  /** Applies a batch from the current drawer; a batch for a newer turn opens it first. */
  apply(code: string, batch: InkBatch, now: number): BatchOutcome;
  /** Freezes the turn's log for the gallery, then drops the oldest past the room's budget. */
  close(code: string, turnId: number): void;
  /** Rematch or Back to lobby: drops every log of the room. */
  reset(code: string): void;
  /** The room expired. */
  forget(code: string): void;
  /** The latest turn's whole stack and `seq`, live or frozen; null with no turn. */
  snapshot(code: string): InkSnapshot | null;
  /** The live turn's last applied `seq`; null when `turnId` isn't the room's live turn. */
  lastSeq(code: string, turnId: number): number | null;
  /** A frozen turn's stack as ops, for the gallery; null if it is live, dropped or unknown. */
  frozen(code: string, turnId: number): InkOp[] | null;
  /** The room's latest log (read-only; for tests). */
  turn(code: string): TurnLog | undefined;
  /** What the room's frozen logs count against its budget. */
  keptBytes(code: string): number;
}

interface RoomInk {
  latest?: TurnLog;
  /** Frozen logs still kept, oldest first; the latest is here once frozen. */
  kept: TurnLog[];
}

const CLEAR_BYTES = JSON.stringify(['c']).length;

export function createInkStore(limits: Partial<InkStoreLimits> = {}): InkStore {
  const { turnMax, hardMax, maxActions, roomMax, resendAskMs } = { ...DEFAULT_LIMITS, ...limits };
  const rooms = new Map<string, RoomInk>();

  const room = (code: string): RoomInk => {
    let r = rooms.get(code);
    if (!r) rooms.set(code, (r = { kept: [] }));
    return r;
  };

  // An action's objects cost far more than its encoded ops; the overhead keeps tiny strokes honest.
  const keptBytes = (r: RoomInk) =>
    r.kept.reduce(
      (sum, log) => sum + log.bytes + INK_ACTION_OVERHEAD_BYTES * log.stack.actions.length,
      0,
    );

  function freeze(r: RoomInk, log: TurnLog): void {
    if (log.frozen) return;
    log.frozen = true;
    log.asked = null;
    r.kept.push(log);
    // The newest log always stays: one turn (≤ hardMax) never passes the room's budget alone.
    while (r.kept.length > 1 && keptBytes(r) > roomMax) r.kept.shift();
  }

  function open(code: string, turnId: number): void {
    const r = room(code);
    if (r.latest) freeze(r, r.latest);
    r.latest = {
      turnId,
      stack: createInkStack(),
      lastSeq: 0,
      frozen: false,
      bytes: 0,
      clearMarks: [],
      strokeBytes: new Map(),
      asked: null,
    };
  }

  /** Applies one op within the caps. `kept` says whether it goes into the relay; `refused`
   * whether the canvas refused it (a no-op such as a `p` for an unknown stroke is neither). */
  function applyOp(log: TurnLog, op: InkOp): { kept: boolean; refused: boolean } {
    const { stack } = log;
    // SPEC-QUESTION: "the log is capped at 200 KB … undo or clear to keep drawing". A clear only
    // helps if the cap is on the visible picture, so that is what `turnMax` measures; the whole
    // stack (strokes kept under clears) has the hard bound (DECISIONS 35).
    const fits = (n: number) => visibleBytes(log) < turnMax && log.bytes + n <= hardMax;
    switch (op[0]) {
      case 'b': {
        const n = JSON.stringify(op).length;
        if (!fits(n) || stack.actions.length >= maxActions) return { kept: false, refused: true };
        applyInkOps(stack, [op]);
        const last = stack.actions[stack.actions.length - 1]!;
        if (last.kind === 'stroke') log.strokeBytes.set(last.stroke, n);
        log.bytes += n;
        return { kept: true, refused: false };
      }
      case 'p': {
        const stroke = stack.byId.get(op[1]);
        if (!stroke || stroke.ended) return { kept: false, refused: false };
        const n = JSON.stringify(op).length;
        if (!fits(n)) return { kept: false, refused: true };
        applyInkOps(stack, [op]);
        log.strokeBytes.set(stroke, (log.strokeBytes.get(stroke) ?? 0) + n);
        log.bytes += n;
        return { kept: true, refused: false };
      }
      case 'e': {
        const stroke = stack.byId.get(op[1]);
        if (!stroke || stroke.ended) return { kept: false, refused: false };
        applyInkOps(stack, [op]);
        return { kept: true, refused: false };
      }
      case 'u': {
        const last = stack.actions[stack.actions.length - 1];
        if (!last) return { kept: false, refused: false };
        applyInkOps(stack, [op]);
        if (last.kind === 'clear') {
          log.clearMarks.pop();
          log.bytes -= CLEAR_BYTES;
        } else {
          log.bytes -= log.strokeBytes.get(last.stroke) ?? 0;
          log.strokeBytes.delete(last.stroke);
        }
        return { kept: true, refused: false };
      }
      case 'c': {
        if (log.bytes + CLEAR_BYTES > hardMax || stack.actions.length >= maxActions)
          return { kept: false, refused: true };
        applyInkOps(stack, [op]);
        log.bytes += CLEAR_BYTES;
        log.clearMarks.push(log.bytes);
        return { kept: true, refused: false };
      }
    }
  }

  return {
    open,

    apply(code, batch, now) {
      const [turnId, seq, ops] = batch;
      const r = room(code);
      if (!r.latest || turnId > r.latest.turnId) open(code, turnId);
      const log = r.latest!;
      if (log.turnId !== turnId || log.frozen) return { kind: 'closed' };
      if (seq <= log.lastSeq) return { kind: 'duplicate' };
      if (seq > log.lastSeq + 1) {
        const from = log.lastSeq + 1;
        const ask = log.asked?.from !== from || now - log.asked.at >= resendAskMs;
        if (ask) log.asked = { from, at: now };
        return { kind: 'gap', from, ask };
      }
      log.lastSeq = seq;
      log.asked = null;
      const kept: InkOp[] = [];
      let full = false;
      for (const op of ops) {
        const res = applyOp(log, op);
        if (res.kept) kept.push(op);
        full ||= res.refused;
      }
      // SPEC-QUESTION: the spec says refused strokes, not refused batches. The batch keeps its
      // `seq` and is relayed without them, so undo and clear in it still apply (DECISIONS 35).
      return {
        kind: 'applied',
        relay: kept.length === ops.length ? batch : [turnId, seq, kept],
        full,
      };
    },

    close(code, turnId) {
      const r = rooms.get(code);
      if (r?.latest?.turnId === turnId) freeze(r, r.latest);
    },

    reset: (code) => void rooms.delete(code),
    forget: (code) => void rooms.delete(code),

    snapshot(code) {
      const log = rooms.get(code)?.latest;
      return log ? { turnId: log.turnId, seq: log.lastSeq, actions: stackOps(log.stack) } : null;
    },

    lastSeq(code, turnId) {
      const log = rooms.get(code)?.latest;
      return log && log.turnId === turnId && !log.frozen ? log.lastSeq : null;
    },

    frozen(code, turnId) {
      const log = rooms.get(code)?.kept.find((l) => l.turnId === turnId);
      return log ? stackOps(log.stack) : null;
    },

    turn: (code) => rooms.get(code)?.latest,

    keptBytes(code) {
      const r = rooms.get(code);
      return r ? keptBytes(r) : 0;
    },
  };
}

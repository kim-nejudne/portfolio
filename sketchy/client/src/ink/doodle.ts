// The phone's lobby doodle (Lobby doodles): the player's own action stack, sent to the server as
// one `doodle:batch` per finished stroke or undo (no 50 ms flushes). The stroke is simplified with
// the drawer's RDP when the finger lifts, and the pad keeps that simplified line, so the pad, the
// server and the Screens hold the same stack. A stroke the server refuses (the doodle is full, the
// game started, the link is down) is taken off the pad again, and a refused undo is put back. With
// no answer at all (`null`, a timeout) the pad keeps what it shows: the server most likely took it.
//
// The stack is kept in sessionStorage per room and player, so a reload shows the doodle the
// Screens still have and new strokes continue its strokeIds.

import {
  applyInkOps,
  createInkStack,
  popAction,
  pushStroke,
  simplify,
  stackOps,
  strokeOps,
  type InkStack,
  type InkStroke,
} from '../../../shared/ink.js';
import type { Ack, InkOp } from '../../../shared/types.js';

/** `ok`: on the Screens; `full`: the doodle has no room left; `refused`: anything else. */
export type DoodleResult = 'ok' | 'full' | 'refused';

export interface PhoneDoodle {
  stack: InkStack;
  /** Starts a stroke at grid point (x, y) on the pad's stack; push its points as the finger moves. */
  begin(color: number, size: number, x: number, y: number): InkStroke;
  /** The finger lifted: simplify, send, and take the stroke off again if the server refuses it. */
  end(stroke: InkStroke): Promise<DoodleResult>;
  /**
   * Undoes the last stroke and sends it; put back if refused. Null (nothing done) with nothing to
   * undo, a stroke in hand, or a send still unanswered, so the server never undoes a different one.
   */
  undo(): Promise<DoodleResult> | null;
  /** Whether `undo` would do something now. */
  canUndo(): boolean;
}

/** Sends ops on `/ink`: the ack, or null when none came (timeout). */
export type SendDoodle = (ops: InkOp[]) => Promise<Ack | null>;

export function createPhoneDoodle(initial: readonly InkOp[], send: SendDoodle): PhoneDoodle {
  const stack = createInkStack();
  applyInkOps(stack, initial);
  let lastId = Math.max(0, ...stack.byId.keys());
  let open = false;
  let inFlight = 0;

  const sendOps = async (ops: InkOp[]) => {
    inFlight += 1;
    try {
      return await send(ops);
    } finally {
      inFlight -= 1;
    }
  };
  const canUndo = () => !open && inFlight === 0 && stack.actions.length > 0;

  return {
    stack,
    begin(color, size, x, y) {
      open = true;
      return pushStroke(stack, ++lastId, color, size, x, y);
    },
    async end(stroke) {
      open = false;
      stroke.points = simplify(stroke.points);
      stroke.ended = true;
      const res = await sendOps(strokeOps(stroke));
      if (res === null || res.ok) return 'ok';
      removeStroke(stack, stroke);
      return res.error === 'inkFull' ? 'full' : 'refused';
    },
    undo() {
      if (!canUndo()) return null;
      const last = stack.actions[stack.actions.length - 1]!;
      popAction(stack);
      return sendOps([['u']]).then((res): DoodleResult => {
        if (res === null || res.ok) return 'ok';
        stack.actions.push(last);
        if (last.kind === 'stroke') stack.byId.set(last.stroke.id, last.stroke);
        return 'refused';
      });
    },
    canUndo,
  };
}

/** Takes `stroke` off the stack wherever it is (later strokes may already be on it). */
function removeStroke(stack: InkStack, stroke: InkStroke): void {
  const i = stack.actions.findIndex((a) => a.kind === 'stroke' && a.stroke === stroke);
  if (i !== -1) stack.actions.splice(i, 1);
  if (stack.byId.get(stroke.id) === stroke) stack.byId.delete(stroke.id);
}

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export const doodleKey = (code: string, pid: string) => `sketchy:doodle:${code}:${pid}`;

/** The saved doodle's ops, or none when missing, unreadable or malformed. */
export function loadDoodle(key: string, store = defaultStore()): InkOp[] {
  try {
    const raw = store?.getItem(key);
    if (!raw) return [];
    const ops: unknown = JSON.parse(raw);
    // Checked by hand (no zod on the join path); the server validates whatever is sent anyway.
    return Array.isArray(ops) && ops.every(isOp) ? (ops as InkOp[]) : [];
  } catch {
    return [];
  }
}

const isOp = (op: unknown): boolean =>
  Array.isArray(op) &&
  typeof op[0] === 'string' &&
  op[0].length === 1 &&
  'bpeuc'.includes(op[0]) &&
  op.slice(1).every((n) => Number.isInteger(n));

export function saveDoodle(key: string, stack: InkStack, store = defaultStore()): void {
  try {
    store?.setItem(key, JSON.stringify(stackOps(stack)));
  } catch {
    // Full or blocked storage: the doodle still lives on the Screens.
  }
}

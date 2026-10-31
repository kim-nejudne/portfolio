// The phone's lobby doodle (F55): a warm-up that stays on the phone. Nothing is sent, so it works
// with `/ink` down. The stroke is simplified with the drawer's RDP when the finger lifts, which
// keeps the saved stack small. The whole stack stays within `DOODLE_MAX_BYTES` encoded: a stroke
// that would pass it is taken off again ("Your doodle is full"), and only Undo makes room.
//
// The stack is kept in sessionStorage per room and player, so a reload shows the same doodle and
// new strokes continue its strokeIds.

import {
  applyInkOps,
  createInkStack,
  popAction,
  pushStroke,
  simplify,
  stackOps,
  type InkStack,
  type InkStroke,
} from '../../../shared/ink.js';
import type { InkOp } from '../../../shared/types.js';

/** The doodle's whole stack, encoded, never passes this. */
export const DOODLE_MAX_BYTES = 20 * 1024;

/** `ok`: on the pad; `full`: the stroke would pass the size cap, so it was taken off. */
export type DoodleResult = 'ok' | 'full';

export interface PhoneDoodle {
  stack: InkStack;
  /** Starts a stroke at grid point (x, y) on the pad's stack; push its points as the finger moves. */
  begin(color: number, size: number, x: number, y: number): InkStroke;
  /** The finger lifted: simplify, and take the stroke off again if the doodle is full. */
  end(stroke: InkStroke): DoodleResult;
  /** Undoes the last stroke; false (nothing done) with nothing to undo or a stroke in hand. */
  undo(): boolean;
  /** Whether `undo` would do something now. */
  canUndo(): boolean;
}

export function createPhoneDoodle(
  initial: readonly InkOp[],
  maxBytes = DOODLE_MAX_BYTES,
): PhoneDoodle {
  const stack = createInkStack();
  applyInkOps(stack, initial);
  let lastId = Math.max(0, ...stack.byId.keys());
  let open = false;
  const canUndo = () => !open && stack.actions.length > 0;

  return {
    stack,
    begin(color, size, x, y) {
      open = true;
      return pushStroke(stack, ++lastId, color, size, x, y);
    },
    end(stroke) {
      open = false;
      stroke.points = simplify(stroke.points);
      stroke.ended = true;
      if (JSON.stringify(stackOps(stack)).length <= maxBytes) return 'ok';
      removeStroke(stack, stroke);
      return 'full';
    },
    undo() {
      if (!canUndo()) return false;
      popAction(stack);
      return true;
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
    // Checked by hand (no zod on the join path).
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
    // Full or blocked storage: the doodle stays on the pad until the page goes.
  }
}

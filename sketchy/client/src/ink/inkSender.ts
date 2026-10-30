// The drawer's outgoing ink for one turn: strokes become `b`/`p`/`e` ops on the 1024 grid, sent as
// `[turnId, seq, ops]` batches every INK_FLUSH_MS while there are pending ops, and at once when a
// stroke ends. Nothing is sent while the finger isn't moving. See "Drawing data protocol".
//
// v0 (F06): no radial filter or RDP simplification (F11), no kept batches for resend (F12), no
// undo or clear ops yet.
//
// The caller (the F08 pad) owns the DOM: call `flush()` on `visibilitychange` (hidden) and
// `pagehide`, since background tabs throttle or freeze the timer, and `end()` on `pointercancel`.

import {
  INK_BATCH_MAX_BYTES,
  INK_FLUSH_MS,
  INK_GRID,
  INK_POINTS_PER_OP_MAX,
} from '../../../shared/constants.js';
import type { InkBatch, InkOp } from '../../../shared/types.js';

/**
 * A canvas position in CSS pixels, `0…sizePx`, as a grid coordinate `0…INK_GRID - 1`. Pass
 * `clientX - rect.left` and `rect.width` from `getBoundingClientRect()`, never `canvas.width`
 * (that is `size × devicePixelRatio` and would shrink the drawing on high-density phones).
 */
export function toGrid(px: number, sizePx: number): number {
  if (!(sizePx > 0) || !Number.isFinite(px)) return 0;
  const g = Math.floor((px / sizePx) * INK_GRID);
  return Math.min(INK_GRID - 1, Math.max(0, g));
}

export interface InkSender {
  /** Starts a stroke at grid point (x, y); returns its strokeId. Ends any stroke still open. */
  begin(color: number, size: number, x: number, y: number): number;
  /** Adds a grid point to the open stroke. A repeat of the last point is skipped. */
  move(x: number, y: number): void;
  /** Ends the open stroke and sends everything pending at once. */
  end(): void;
  /** Sends everything pending now. */
  flush(): void;
  /** Stops the flush timer and drops pending ops (the turn is over); every later call is a no-op. */
  dispose(): void;
}

export interface InkSenderOptions {
  turnId: number;
  send: (batch: InkBatch) => void;
}

/** One sender per turn: `seq` and strokeIds start at 1. */
export function createInkSender({ turnId, send }: InkSenderOptions): InkSender {
  let seq = 0;
  let strokeId = 0;
  let open: { id: number; x: number; y: number } | null = null;
  let pending: InkOp[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const schedule = () => {
    timer ??= setTimeout(() => {
      timer = null;
      flush();
    }, INK_FLUSH_MS);
  };

  const push = (op: InkOp) => {
    pending.push(op);
    schedule();
  };

  function flush(): void {
    if (disposed) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.length === 0) return;
    // Taken first: if `send` throws, these ops are not sent again under a new seq.
    const all = pending;
    pending = [];
    // Split so no batch passes INK_BATCH_MAX_BYTES; one op always fits (≤ 200 points). The size
    // is exact: the envelope with no ops, plus each op, plus the commas between them.
    let ops: InkOp[] = [];
    let bytes = 0;
    const envelope = () => JSON.stringify([turnId, seq + 1, []]).length;
    for (const op of all) {
      const opBytes = JSON.stringify(op).length;
      if (ops.length > 0 && bytes + 1 + opBytes > INK_BATCH_MAX_BYTES) {
        send([turnId, ++seq, ops]);
        ops = [];
      }
      bytes = ops.length === 0 ? envelope() + opBytes : bytes + 1 + opBytes;
      ops.push(op);
    }
    send([turnId, ++seq, ops]);
  }

  function end(): void {
    if (disposed) return;
    if (open) push(['e', open.id]);
    open = null;
    flush();
  }

  return {
    begin(color, size, x, y) {
      if (disposed) return 0;
      if (open) push(['e', open.id]);
      open = { id: ++strokeId, x, y };
      push(['b', open.id, color, size, x, y]);
      return open.id;
    },
    move(x, y) {
      if (disposed || !open || (x === open.x && y === open.y)) return;
      const dx = x - open.x;
      const dy = y - open.y;
      open.x = x;
      open.y = y;
      const last = pending[pending.length - 1];
      if (
        last?.[0] === 'p' &&
        last[1] === open.id &&
        (last.length - 2) / 2 < INK_POINTS_PER_OP_MAX
      ) {
        last.push(dx, dy);
        return;
      }
      push(['p', open.id, dx, dy]);
    },
    end,
    flush,
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      pending = [];
      open = null;
    },
  };
}

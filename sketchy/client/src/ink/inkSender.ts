// The drawer's outgoing ink for one turn: strokes become `b`/`p`/`e` ops on the 1024 grid, sent as
// `[turnId, seq, ops]` batches every INK_FLUSH_MS while there are pending ops, and at once when a
// stroke ends, on undo and on clear. Nothing is sent while the finger isn't moving. See "Drawing
// data protocol" (Drawer client).
//
// Each point passes the radial filter (dropped when closer than INK_RADIAL_MIN to the last kept
// point); before a flush the stroke's pending points are simplified with RDP at INK_RDP_EPSILON,
// keeping the first and last. The codec, filter and RDP are `shared/ink.ts`, the same code the
// server and the Screen decode with. Kept batches for resending come with F12.
//
// The caller (the pad) owns the DOM: call `flush()` on `visibilitychange` (hidden) and `pagehide`,
// since background tabs throttle or freeze the timer, and `end()` on `pointercancel`.

import { INK_FLUSH_MS, INK_GRID } from '../../../shared/constants.js';
import { farEnough, packBatches, pointOps, simplify } from '../../../shared/ink.js';
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
  /** Adds a grid point to the open stroke, unless within INK_RADIAL_MIN of the last kept one. */
  move(x: number, y: number): void;
  /** Ends the open stroke at the finger's last point and sends everything pending at once. */
  end(): void;
  /** Undoes the last action (a stroke or a clear) and sends at once. Ends an open stroke first. */
  undo(): void;
  /** Clears the canvas (undoable) and sends at once. Ends an open stroke first. */
  clear(): void;
  /** Sends everything pending now. */
  flush(): void;
  /** Stops the flush timer and drops pending ops (the turn is over); every later call is a no-op. */
  dispose(): void;
}

export interface InkSenderOptions {
  turnId: number;
  send: (batch: InkBatch) => void;
}

interface OpenStroke {
  id: number;
  /** The last point sent (or the begin point): the next `p` op's deltas start here. */
  anchorX: number;
  anchorY: number;
  /** Points kept by the radial filter since the anchor, absolute, flat. */
  points: number[];
  /** The last kept point, for the radial filter. */
  lastX: number;
  lastY: number;
  /** The finger's latest point, kept or not, so the stroke ends where the finger lifted. */
  rawX: number;
  rawY: number;
}

/** One sender per turn: `seq` and strokeIds start at 1. */
export function createInkSender({ turnId, send }: InkSenderOptions): InkSender {
  let seq = 0;
  let strokeId = 0;
  let open: OpenStroke | null = null;
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

  /** Turns the open stroke's kept points into `p` ops, simplified from its anchor on. */
  const takePoints = () => {
    if (!open || open.points.length === 0) return;
    const kept = simplify([open.anchorX, open.anchorY, ...open.points]).slice(2);
    pending.push(...pointOps(open.id, open.anchorX, open.anchorY, kept));
    open.anchorX = kept[kept.length - 2]!;
    open.anchorY = kept[kept.length - 1]!;
    open.points = [];
  };

  /** Ends the open stroke at the finger's last point, without flushing. */
  const finish = () => {
    if (!open) return;
    if (open.rawX !== open.lastX || open.rawY !== open.lastY)
      open.points.push(open.rawX, open.rawY);
    takePoints();
    push(['e', open.id]);
    open = null;
  };

  function flush(): void {
    if (disposed) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    takePoints();
    if (pending.length === 0) return;
    // Taken and numbered first: if `send` throws, these ops are not sent again under a new seq.
    const batches = packBatches(turnId, seq + 1, pending);
    pending = [];
    seq += batches.length;
    for (const batch of batches) send(batch);
  }

  return {
    begin(color, size, x, y) {
      if (disposed) return 0;
      finish();
      open = {
        id: ++strokeId,
        anchorX: x,
        anchorY: y,
        points: [],
        lastX: x,
        lastY: y,
        rawX: x,
        rawY: y,
      };
      push(['b', open.id, color, size, x, y]);
      return open.id;
    },
    move(x, y) {
      if (disposed || !open) return;
      open.rawX = x;
      open.rawY = y;
      if (!farEnough(open.lastX, open.lastY, x, y)) return;
      open.lastX = x;
      open.lastY = y;
      open.points.push(x, y);
      schedule();
    },
    end() {
      if (disposed) return;
      finish();
      flush();
    },
    undo() {
      if (disposed) return;
      finish();
      push(['u']);
      flush();
    },
    clear() {
      if (disposed) return;
      finish();
      push(['c']);
      flush();
    },
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

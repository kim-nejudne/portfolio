// The Screen's picture of one turn's ink, and the shared `drawStroke` (Canvas and drawing tools,
// Rendering). Points are absolute on the INK_GRID; each device scales them to its own canvas.
//
// v0 (F07): a small action stack (strokes and clears, `u` pops the last one) kept here on the
// client. F11 moves the codec and the action stack into `shared/ink.ts` for the drawer, the server
// and the Screen alike; this file then keeps only the rendering. Batches are applied in arrival
// order with no `seq` check: a lost batch leaves a gap until F12 adds `ink:resend` and snapshots.

import {
  CANVAS_COLOR,
  DRAW_COLORS,
  ERASER_COLOR_INDEX,
  INK_GRID,
  INK_SIZES,
} from '../../../shared/constants.js';
import type { InkBatch, InkOp } from '../../../shared/types.js';

export interface InkStroke {
  id: number;
  color: number;
  size: number;
  /** Absolute grid points, flat: `[x0, y0, x1, y1, …]`. */
  points: number[];
  ended: boolean;
}

type InkAction = { kind: 'stroke'; stroke: InkStroke } | { kind: 'clear' };

export interface InkPicture {
  turnId: number;
  actions: InkAction[];
  /** Strokes still on the stack, by strokeId, for `p` and `e` ops. */
  byId: Map<number, InkStroke>;
}

/** What to repaint after a batch: the strokes that grew, or everything (undo, clear). */
export interface InkChange {
  dirty: number[];
  redraw: boolean;
}

export function createInkPicture(turnId: number): InkPicture {
  return { turnId, actions: [], byId: new Map() };
}

export function applyInkOps(pic: InkPicture, ops: readonly InkOp[]): InkChange {
  const dirty = new Set<number>();
  let redraw = false;
  for (const op of ops) {
    switch (op[0]) {
      case 'b': {
        const [, id, color, size, x, y] = op;
        const stroke: InkStroke = { id, color, size, points: [x, y], ended: false };
        pic.actions.push({ kind: 'stroke', stroke });
        pic.byId.set(id, stroke);
        dirty.add(id);
        break;
      }
      case 'p': {
        const [, id, ...deltas] = op;
        const stroke = pic.byId.get(id);
        // A stroke that began before this Screen joined: nothing to anchor the deltas to.
        if (!stroke || stroke.ended) break;
        const pts = stroke.points;
        for (let i = 0; i + 1 < deltas.length; i += 2) {
          pts.push(pts[pts.length - 2]! + deltas[i]!, pts[pts.length - 1]! + deltas[i + 1]!);
        }
        dirty.add(id);
        break;
      }
      case 'e': {
        const stroke = pic.byId.get(op[1]);
        if (stroke) stroke.ended = true;
        break;
      }
      case 'u': {
        const last = pic.actions.pop();
        if (last?.kind === 'stroke') pic.byId.delete(last.stroke.id);
        if (last) redraw = true;
        break;
      }
      case 'c':
        pic.actions.push({ kind: 'clear' });
        redraw = true;
        break;
    }
  }
  return { dirty: redraw ? [] : [...dirty], redraw };
}

/** Every stroke after the last clear still on the stack, in drawing order. */
export function visibleStrokes(pic: InkPicture): InkStroke[] {
  const out: InkStroke[] = [];
  for (const action of pic.actions) {
    if (action.kind === 'clear') out.length = 0;
    else out.push(action.stroke);
  }
  return out;
}

function strokeColor(color: number): string {
  return color === ERASER_COLOR_INDEX ? CANVAS_COLOR : (DRAW_COLORS[color] ?? DRAW_COLORS[0]);
}

/**
 * Draws `stroke` onto a canvas `canvasPx` wide, smoothed with quadratic curves through the
 * midpoints of consecutive points. `fromPoint` (a point index) draws only the part from there on:
 * the curve up to the midpoint before it is final, so live strokes are drawn incrementally.
 * Returns the index to pass next time.
 */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: InkStroke,
  canvasPx: number,
  fromPoint = 0,
): number {
  const s = canvasPx / INK_GRID;
  const p = stroke.points;
  const n = p.length / 2;
  if (n === 0) return 0;
  const x = (i: number) => p[2 * i]! * s;
  const y = (i: number) => p[2 * i + 1]! * s;
  const midX = (i: number) => (x(i) + x(i + 1)) / 2;
  const midY = (i: number) => (y(i) + y(i + 1)) / 2;

  ctx.strokeStyle = strokeColor(stroke.color);
  ctx.lineWidth = (INK_SIZES[stroke.size] ?? INK_SIZES[1]) * s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const start = Math.min(fromPoint, Math.max(0, n - 2));
  if (start === 0) ctx.moveTo(x(0), y(0));
  else ctx.moveTo(midX(start - 1), midY(start - 1));
  for (let i = Math.max(1, start); i < n - 1; i++)
    ctx.quadraticCurveTo(x(i), y(i), midX(i), midY(i));
  // The tail to the newest point is provisional until another point arrives; a lone point is a dot.
  ctx.lineTo(x(n - 1), y(n - 1));
  ctx.stroke();
  return Math.max(0, n - 1);
}

/** Paints the canvas white and draws every visible stroke. */
export function redrawPicture(
  ctx: CanvasRenderingContext2D,
  pic: InkPicture | null,
  canvasPx: number,
): Map<number, number> {
  ctx.fillStyle = CANVAS_COLOR;
  ctx.fillRect(0, 0, canvasPx, canvasPx);
  const drawn = new Map<number, number>();
  if (pic)
    for (const stroke of visibleStrokes(pic))
      drawn.set(stroke.id, drawStroke(ctx, stroke, canvasPx));
  return drawn;
}

/**
 * The Screen's live ink across turns: `ink:turn` clears, `ink:batch` appends. A batch for an
 * older turn is dropped; one for a newer turn starts it (the two namespaces don't share an order,
 * and a Screen that loaded mid-turn never saw that turn's `ink:turn`).
 */
export interface ScreenInk {
  turn(turnId: number): void;
  batch(batch: InkBatch): void;
  picture(): InkPicture | null;
  subscribe(listener: (change: InkChange) => void): () => void;
}

export function createScreenInk(): ScreenInk {
  let pic: InkPicture | null = null;
  const listeners = new Set<(change: InkChange) => void>();
  const emit = (change: InkChange) => {
    for (const listener of listeners) listener(change);
  };
  const start = (turnId: number) => {
    pic = createInkPicture(turnId);
    emit({ dirty: [], redraw: true });
  };
  return {
    turn(turnId) {
      if (pic === null || turnId > pic.turnId) start(turnId);
    },
    batch([turnId, , ops]) {
      if (pic !== null && turnId < pic.turnId) return;
      if (pic === null || turnId > pic.turnId) start(turnId);
      const change = applyInkOps(pic!, ops);
      if (change.redraw || change.dirty.length > 0) emit(change);
    },
    picture: () => pic,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

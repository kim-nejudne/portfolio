// The Screen's picture of one turn's ink, and the shared `drawStroke` (Canvas and drawing tools,
// Rendering). Points are absolute on the INK_GRID; each device scales them to its own canvas.
//
// The codec and the action stack are `shared/ink.ts`, the same code the drawer and the server use;
// this file keeps the rendering and the Screen's feed across turns. Batches apply in `seq` order:
// a gap means batches were lost (a dropped connection), so the Screen asks for a fresh snapshot.

import {
  CANVAS_COLOR,
  DRAW_COLORS,
  ERASER_COLOR_INDEX,
  INK_GRID,
  INK_SIZES,
} from '../../../shared/constants.js';
import {
  applyInkOps,
  createInkStack,
  visibleStrokes,
  type InkChange,
  type InkStack,
  type InkStroke,
} from '../../../shared/ink.js';
import type { InkBatch, InkSnapshot } from '../../../shared/types.js';

/** One turn's action stack, as the Screen holds it, and the last `seq` applied to it. */
export interface InkPicture extends InkStack {
  turnId: number;
  seq: number;
}

export function createInkPicture(turnId: number, seq = 0): InkPicture {
  return { ...createInkStack(), turnId, seq };
}

function strokeColor(color: number): string {
  return color === ERASER_COLOR_INDEX ? CANVAS_COLOR : (DRAW_COLORS[color] ?? DRAW_COLORS[0]);
}

/**
 * Draws `stroke` onto a canvas `canvasPx` wide, smoothed with quadratic curves through the
 * midpoints of consecutive points. `fromPoint` (a point index) draws only the part from there on:
 * the curve up to the midpoint before it is final, so live strokes are drawn incrementally.
 * `lineScale` thickens the line (doodle avatars, drawn tiny). Returns the index to pass next time.
 */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: InkStroke,
  canvasPx: number,
  fromPoint = 0,
  lineScale = 1,
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
  ctx.lineWidth = (INK_SIZES[stroke.size] ?? INK_SIZES[1]) * s * lineScale;
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
  pic: InkStack | null,
  canvasPx: number,
  lineScale = 1,
): Map<number, number> {
  ctx.fillStyle = CANVAS_COLOR;
  ctx.fillRect(0, 0, canvasPx, canvasPx);
  const drawn = new Map<number, number>();
  if (pic)
    for (const stroke of visibleStrokes(pic))
      drawn.set(stroke.id, drawStroke(ctx, stroke, canvasPx, 0, lineScale));
  return drawn;
}

/** What a canvas draws: a picture, and word of each change to it. */
export interface InkSource {
  picture(): InkStack | null;
  subscribe(listener: (change: InkChange) => void): () => void;
}

/** A finished drawing (the gallery's): drawn once, never changes. */
export function staticInk(stack: InkStack | null): InkSource {
  return { picture: () => stack, subscribe: () => () => {} };
}

/**
 * The Screen's live ink across turns: `ink:turn` clears, `ink:snapshot` replaces the picture,
 * `ink:batch` appends. A batch for an older turn is dropped; one for a newer turn starts it (the
 * two namespaces don't share an order). Within a turn batches apply in `seq` order: a repeat is
 * dropped, and the first gap answers `'gap'` (say `ink:hello` again); later batches wait for the
 * snapshot, which covers them.
 */
export interface ScreenInk extends InkSource {
  turn(turnId: number): void;
  batch(batch: InkBatch): 'ok' | 'gap' | 'ignored';
  snapshot(snapshot: InkSnapshot): void;
  picture(): InkPicture | null;
  subscribe(listener: (change: InkChange) => void): () => void;
}

export function createScreenInk(): ScreenInk {
  let pic: InkPicture | null = null;
  let awaitingSnapshot = false;
  const listeners = new Set<(change: InkChange) => void>();
  const emit = (change: InkChange) => {
    for (const listener of listeners) listener(change);
  };
  const start = (turnId: number) => {
    pic = createInkPicture(turnId);
    awaitingSnapshot = false;
    emit({ dirty: [], redraw: true });
    return pic;
  };
  return {
    turn(turnId) {
      if (pic === null || turnId > pic.turnId) start(turnId);
    },
    batch([turnId, seq, ops]) {
      if (pic !== null && turnId < pic.turnId) return 'ignored';
      const p = pic === null || turnId > pic.turnId ? start(turnId) : pic;
      if (awaitingSnapshot || seq <= p.seq) return 'ignored';
      if (seq > p.seq + 1) {
        awaitingSnapshot = true;
        return 'gap';
      }
      p.seq = seq;
      const change = applyInkOps(p, ops);
      if (change.redraw || change.dirty.length > 0) emit(change);
      return 'ok';
    },
    snapshot({ turnId, seq, actions }) {
      if (pic !== null && turnId < pic.turnId) return;
      // Filled before it is shown, so the one repaint draws all of it.
      const p = createInkPicture(turnId, seq);
      applyInkOps(p, actions);
      pic = p;
      awaitingSnapshot = false;
      emit({ dirty: [], redraw: true });
    },
    picture: () => pic,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

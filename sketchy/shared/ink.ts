// Ink: the codec and the action stack, used identically by the drawer, the server and the Screen
// (Drawing data protocol, "Ops and encoding"). Points are absolute integers on the INK_GRID; on the
// wire each `p` point is relative to the one before it.
//
// The action stack is a list of actions, each a stroke (colour, size, points) or a clear. `u` pops
// the last action; `c` pushes a clear. The visible picture is every stroke after the last clear
// still on the stack, drawn in order. Pure functions over plain data: no DOM, no timers.

import {
  INK_BATCH_MAX_BYTES,
  INK_GRID,
  INK_POINTS_PER_OP_MAX,
  INK_RADIAL_MIN,
  INK_RDP_EPSILON,
  INK_SEGMENT_MAX,
} from './constants.js';
import type { InkBatch, InkOp } from './types.js';

export interface InkStroke {
  id: number;
  /** 0–7 palette index, 8 = eraser. */
  color: number;
  /** 0, 1, 2 = S, M, L. */
  size: number;
  /** Absolute grid points, flat: `[x0, y0, x1, y1, …]`. */
  points: number[];
  ended: boolean;
}

export type InkAction = { kind: 'stroke'; stroke: InkStroke } | { kind: 'clear' };

export interface InkStack {
  actions: InkAction[];
  /** Strokes still on the stack, by strokeId, for `p` and `e` ops. */
  byId: Map<number, InkStroke>;
}

/** What to repaint after some ops: the strokes that grew, or everything (undo, clear). */
export interface InkChange {
  dirty: number[];
  redraw: boolean;
}

export function createInkStack(): InkStack {
  return { actions: [], byId: new Map() };
}

/** A coordinate on the grid, 0 to INK_GRID - 1. */
export function clampToGrid(v: number): number {
  return Math.min(INK_GRID - 1, Math.max(0, v));
}

// ---------- Codec ----------

/** Each point of `points` relative to the one before it, the first relative to (x0, y0). */
export function encodeDeltas(x0: number, y0: number, points: readonly number[]): number[] {
  const out: number[] = [];
  let x = x0;
  let y = y0;
  for (let i = 0; i + 1 < points.length; i += 2) {
    out.push(points[i]! - x, points[i + 1]! - y);
    x = points[i]!;
    y = points[i + 1]!;
  }
  return out;
}

/**
 * The absolute points of `deltas` continuing from (x0, y0). Each point is clamped to the grid and
 * the next continues from the clamped point, so every device decodes the same picture.
 */
export function decodeDeltas(x0: number, y0: number, deltas: readonly number[]): number[] {
  const out: number[] = [];
  let x = x0;
  let y = y0;
  for (let i = 0; i + 1 < deltas.length; i += 2) {
    x = clampToGrid(x + deltas[i]!);
    y = clampToGrid(y + deltas[i + 1]!);
    out.push(x, y);
  }
  return out;
}

/** `p` ops for `points` (absolute) continuing from (x0, y0), at most INK_POINTS_PER_OP_MAX each. */
export function pointOps(id: number, x0: number, y0: number, points: readonly number[]): InkOp[] {
  const deltas = encodeDeltas(x0, y0, points);
  const ops: InkOp[] = [];
  for (let i = 0; i < deltas.length; i += 2 * INK_POINTS_PER_OP_MAX)
    ops.push(['p', id, ...deltas.slice(i, i + 2 * INK_POINTS_PER_OP_MAX)]);
  return ops;
}

/** A stroke as `b`, `p`… and, once it has ended, `e`. */
export function strokeOps(stroke: InkStroke): InkOp[] {
  const [x0 = 0, y0 = 0] = stroke.points;
  const ops: InkOp[] = [
    ['b', stroke.id, stroke.color, stroke.size, x0, y0],
    ...pointOps(stroke.id, x0, y0, stroke.points.slice(2)),
  ];
  if (stroke.ended) ops.push(['e', stroke.id]);
  return ops;
}

/** Ops that rebuild `stack` exactly on an empty stack: its strokes and clears, in order. */
export function stackOps(stack: InkStack): InkOp[] {
  return stack.actions.flatMap((a): InkOp[] =>
    a.kind === 'clear' ? [['c']] : strokeOps(a.stroke),
  );
}

/**
 * `ops` as `[turnId, seq, ops]` batches numbered from `firstSeq`, split so no batch passes
 * INK_BATCH_MAX_BYTES encoded. One op always fits (≤ 200 points). The size is exact: the envelope
 * with no ops, plus each op, plus the commas between them.
 */
export function packBatches(turnId: number, firstSeq: number, ops: readonly InkOp[]): InkBatch[] {
  const batches: InkBatch[] = [];
  let seq = firstSeq;
  let chunk: InkOp[] = [];
  let bytes = 0;
  for (const op of ops) {
    const opBytes = JSON.stringify(op).length;
    if (chunk.length > 0 && bytes + 1 + opBytes > INK_BATCH_MAX_BYTES) {
      batches.push([turnId, seq++, chunk]);
      chunk = [];
    }
    bytes =
      chunk.length === 0 ? JSON.stringify([turnId, seq, []]).length + opBytes : bytes + 1 + opBytes;
    chunk.push(op);
  }
  if (chunk.length > 0) batches.push([turnId, seq, chunk]);
  return batches;
}

// ---------- Simplification (the drawer, before sending) ----------

/** Whether (x, y) is at least `min` grid units from the last kept point (radial filter). */
export function farEnough(
  lastX: number,
  lastY: number,
  x: number,
  y: number,
  min: number = INK_RADIAL_MIN,
): boolean {
  const dx = x - lastX;
  const dy = y - lastY;
  return dx * dx + dy * dy >= min * min;
}

/** Squared distance from p to the segment a–b. */
function segmentDistSq(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const ex = px - (ax + t * dx);
  const ey = py - (ay + t * dy);
  return ex * ex + ey * ey;
}

/**
 * Ramer–Douglas–Peucker over flat `points`: the indices of the points kept, in order. The first
 * and last are always kept; every dropped point is within `epsilon` of the segment joining the
 * kept points either side of it. Iterative, so a long stroke can't overflow the call stack.
 *
 * A span longer than `maxSegment` that still has points inside is split at its middle point even
 * when they are all within ε, so no kept gap passes `maxSegment` where the drawn points allow it.
 */
export function simplifyIndices(
  points: readonly number[],
  epsilon: number = INK_RDP_EPSILON,
  maxSegment: number = INK_SEGMENT_MAX,
): number[] {
  const n = Math.floor(points.length / 2);
  if (n <= 2) return Array.from({ length: n }, (_, i) => i);
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const eps2 = epsilon * epsilon;
  const max2 = maxSegment * maxSegment;
  const spans: [number, number][] = [[0, n - 1]];
  while (spans.length > 0) {
    const [a, b] = spans.pop()!;
    let far = -1;
    let farDist = eps2;
    for (let i = a + 1; i < b; i++) {
      const d = segmentDistSq(
        points[2 * i]!,
        points[2 * i + 1]!,
        points[2 * a]!,
        points[2 * a + 1]!,
        points[2 * b]!,
        points[2 * b + 1]!,
      );
      if (d > farDist) {
        far = i;
        farDist = d;
      }
    }
    if (far < 0 && b - a > 1) {
      const lx = points[2 * b]! - points[2 * a]!;
      const ly = points[2 * b + 1]! - points[2 * a + 1]!;
      if (lx * lx + ly * ly > max2) far = (a + b) >> 1;
    }
    if (far < 0) continue;
    keep[far] = 1;
    spans.push([a, far], [far, b]);
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}

/** `points` simplified (see `simplifyIndices`), keeping the first and last points. */
export function simplify(
  points: readonly number[],
  epsilon: number = INK_RDP_EPSILON,
  maxSegment: number = INK_SEGMENT_MAX,
): number[] {
  const out: number[] = [];
  for (const i of simplifyIndices(points, epsilon, maxSegment))
    out.push(points[2 * i]!, points[2 * i + 1]!);
  return out;
}

// ---------- Action stack ----------

/** Pushes a new stroke starting at (x, y), as a `b` op does, and returns it to extend. */
export function pushStroke(
  stack: InkStack,
  id: number,
  color: number,
  size: number,
  x: number,
  y: number,
): InkStroke {
  const stroke: InkStroke = { id, color, size, points: [x, y], ended: false };
  stack.actions.push({ kind: 'stroke', stroke });
  stack.byId.set(id, stroke);
  return stroke;
}

/**
 * Pops the last action (a stroke or a clear). Returns whether there was one. A strokeId reused by
 * a later `b` points at the newer stroke, so popping the older one leaves it alone.
 */
export function popAction(stack: InkStack): boolean {
  const last = stack.actions.pop();
  if (last?.kind === 'stroke' && stack.byId.get(last.stroke.id) === last.stroke)
    stack.byId.delete(last.stroke.id);
  return last !== undefined;
}

/** Pushes a clear: every stroke before it is hidden until it is undone. */
export function pushClear(stack: InkStack): void {
  stack.actions.push({ kind: 'clear' });
}

/** Applies ops in order to `stack` and says what to repaint. */
export function applyInkOps(stack: InkStack, ops: readonly InkOp[]): InkChange {
  const dirty = new Set<number>();
  let redraw = false;
  for (const op of ops) {
    switch (op[0]) {
      case 'b': {
        const [, id, color, size, x, y] = op;
        pushStroke(stack, id, color, size, clampToGrid(x), clampToGrid(y));
        dirty.add(id);
        break;
      }
      case 'p': {
        const [, id, ...deltas] = op;
        const stroke = stack.byId.get(id);
        // A stroke that began before this Screen joined, was undone, or has ended.
        if (!stroke || stroke.ended) break;
        const pts = stroke.points;
        pts.push(...decodeDeltas(pts[pts.length - 2]!, pts[pts.length - 1]!, deltas));
        dirty.add(id);
        break;
      }
      case 'e': {
        const stroke = stack.byId.get(op[1]);
        if (stroke) stroke.ended = true;
        break;
      }
      case 'u':
        if (popAction(stack)) redraw = true;
        break;
      case 'c':
        pushClear(stack);
        redraw = true;
        break;
    }
  }
  return { dirty: redraw ? [] : [...dirty], redraw };
}

/** Every stroke after the last clear still on the stack, in drawing order. */
export function visibleStrokes(stack: InkStack): InkStroke[] {
  const out: InkStroke[] = [];
  for (const action of stack.actions) {
    if (action.kind === 'clear') out.length = 0;
    else out.push(action.stroke);
  }
  return out;
}

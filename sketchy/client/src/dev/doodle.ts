// The scripted doodle a dev bot draws when it is the drawer (Dev tool: fake players): a house with
// a door and a sun, on the 1024 ink grid. Development builds only.

import { INK_GRID } from '../../../shared/constants.js';

type Point = [x: number, y: number];

/** Longest move between two points, in grid units: small enough that the Screen sees lines grow. */
export const DOODLE_MAX_STEP = 24;

function circle(cx: number, cy: number, r: number, points = 32): Point[] {
  return Array.from({ length: points + 1 }, (_, i): Point => {
    const a = (i / points) * 2 * Math.PI;
    return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))];
  });
}

/** Each line is one stroke. */
export const DOODLE: Point[][] = [
  // Walls
  [
    [220, 520],
    [220, 880],
    [700, 880],
    [700, 520],
    [220, 520],
  ],
  // Roof
  [
    [180, 540],
    [460, 300],
    [740, 540],
  ],
  // Door
  [
    [400, 880],
    [400, 700],
    [520, 700],
    [520, 880],
  ],
  // Sun
  circle(840, 180, 90),
];

export type DoodleStep =
  | { kind: 'begin'; x: number; y: number }
  | { kind: 'move'; x: number; y: number }
  | { kind: 'end' };

const clamp = (v: number) => Math.min(INK_GRID - 1, Math.max(0, Math.round(v)));

/** The doodle as pen steps, each segment cut into equal moves no longer than `maxStep`. */
export function doodleSteps(lines: Point[][] = DOODLE, maxStep = DOODLE_MAX_STEP): DoodleStep[] {
  const steps: DoodleStep[] = [];
  for (const line of lines) {
    const [first, ...rest] = line;
    if (!first) continue;
    steps.push({ kind: 'begin', x: clamp(first[0]), y: clamp(first[1]) });
    let [px, py] = first;
    for (const [x, y] of rest) {
      const parts = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / maxStep));
      for (let i = 1; i <= parts; i++) {
        steps.push({
          kind: 'move',
          x: clamp(px + ((x - px) * i) / parts),
          y: clamp(py + ((y - py) * i) / parts),
        });
      }
      [px, py] = [x, y];
    }
    steps.push({ kind: 'end' });
  }
  return steps;
}

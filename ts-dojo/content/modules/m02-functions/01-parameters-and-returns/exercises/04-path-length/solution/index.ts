export type Point = readonly [number, number];

/** The straight-line distance between two points. `to` defaults to the origin, [0, 0]. */
export function distance(from: Point, to: Point = [0, 0]): number {
  return Math.hypot(to[0] - from[0], to[1] - from[1]);
}

/** The length of the path through every point, in order; 0 for fewer than two points. */
export function pathLength(...points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distance(points[i - 1], points[i]);
  }
  return length;
}

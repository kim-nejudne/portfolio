export type Point = readonly [number, number];

/** The straight-line distance between two points. `to` defaults to the origin, [0, 0]. */
export function distance(from: unknown, to: unknown = [0, 0]): number {
  throw new Error(
    `not implemented: distance from ${String(from)} to ${String(to)}`,
  );
}

/** The length of the path through every point, in order; 0 for fewer than two points. */
export function pathLength(...points: unknown[]): number {
  throw new Error(`not implemented for ${points.length} points`);
}

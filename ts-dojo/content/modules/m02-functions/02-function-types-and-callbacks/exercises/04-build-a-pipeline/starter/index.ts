/** One step of a calculation: takes a number and returns a number. */
export type Step = (value: number) => number;

/** Runs `value` through every step in order. pipe(3, double, increment) is increment(double(3)). */
export function pipe(value: number, ...steps: unknown[]): number {
  throw new Error(`not implemented: pipe(${value}) with ${steps.length} steps`);
}

/** A step that applies `step` `count` times in a row; `count` is 2 unless given. */
export function repeat(step: unknown, count?: unknown): Step {
  throw new Error(`not implemented: repeat(${String(step)}, ${String(count)})`);
}

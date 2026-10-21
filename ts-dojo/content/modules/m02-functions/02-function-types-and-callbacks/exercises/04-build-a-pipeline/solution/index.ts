/** One step of a calculation: takes a number and returns a number. */
export type Step = (value: number) => number;

/** Runs `value` through every step in order. pipe(3, double, increment) is increment(double(3)). */
export function pipe(value: number, ...steps: Step[]): number {
  let result = value;
  for (const step of steps) result = step(result);
  return result;
}

/** A step that applies `step` `count` times in a row; `count` is 2 unless given. */
export function repeat(step: Step, count = 2): Step {
  return (value) => {
    let result = value;
    for (let i = 0; i < count; i++) result = step(result);
    return result;
  };
}

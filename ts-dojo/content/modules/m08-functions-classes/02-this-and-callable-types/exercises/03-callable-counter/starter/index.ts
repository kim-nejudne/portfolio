/** Call it to count one more. */
export type Counter = () => number;

export function createCounter(start: number): Counter {
  throw new Error(`not implemented, starting at ${start}`);
}

/** Call it to count one more. */
export type Counter = {
  (): number;
  count: number;
  reset(): void;
};

export function createCounter(start: number): Counter {
  function counter() {
    counter.count += 1;
    return counter.count;
  }
  counter.count = start;
  counter.reset = () => {
    counter.count = start;
  };
  return counter;
}

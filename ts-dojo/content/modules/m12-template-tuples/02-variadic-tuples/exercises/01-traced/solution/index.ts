/** A function with fn's parameters and return type: it passes its arguments to onCall, then calls fn. */
export function traced<A extends unknown[], R>(
  fn: (...args: A) => R,
  onCall: (args: A) => void,
): (...args: A) => R {
  return (...args) => {
    onCall(args);
    return fn(...args);
  };
}

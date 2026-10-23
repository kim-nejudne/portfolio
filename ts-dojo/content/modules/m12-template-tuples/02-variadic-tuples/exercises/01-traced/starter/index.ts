/** A function with fn's parameters and return type: it passes its arguments to onCall, then calls fn. */
export function traced(
  fn: (...args: never[]) => unknown,
  onCall: (args: never) => void,
): (...args: unknown[]) => unknown {
  return () => {
    throw new Error(`not implemented: ${fn.name} ${onCall.name}`);
  };
}

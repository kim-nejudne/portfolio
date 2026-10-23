// Any function: flow's first function may take several parameters.
type AnyFn = (...args: never[]) => unknown;

export function flow<Fns extends AnyFn[]>(
  ...fns: Fns
): (...args: unknown[]) => unknown {
  throw new Error(`flow is not implemented: ${fns.length} functions`);
}

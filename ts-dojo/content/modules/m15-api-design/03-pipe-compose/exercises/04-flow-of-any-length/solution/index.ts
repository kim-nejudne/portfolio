// Any function: flow's first function may take several parameters.
type AnyFn = (...args: never[]) => unknown;

// Any function of one parameter.
type Unary = (arg: never) => unknown;

// The functions after the first, each retyped to take the result before it.
type Lined<In, Fns extends Unary[]> = Fns extends [
  infer F extends Unary,
  ...infer Rest extends Unary[],
]
  ? [(arg: In) => ReturnType<F>, ...Lined<ReturnType<F>, Rest>]
  : [];

// What the last function returns, or Else when there is none.
type Last<Fns extends Unary[], Else> = Fns extends [
  ...Unary[],
  infer L extends Unary,
]
  ? ReturnType<L>
  : Else;

export function flow<First extends AnyFn, Fns extends Unary[]>(
  first: First,
  ...rest: Fns & Lined<ReturnType<First>, Fns>
): (...args: Parameters<First>) => Last<Fns, ReturnType<First>>;
export function flow(
  first: (...args: unknown[]) => unknown,
  ...rest: Array<(arg: unknown) => unknown>
): (...args: unknown[]) => unknown {
  return (...args) => rest.reduce((acc, fn) => fn(acc), first(...args));
}

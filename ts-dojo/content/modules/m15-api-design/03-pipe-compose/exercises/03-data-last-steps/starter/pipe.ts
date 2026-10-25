// Given: the pipe from the lesson. Nothing to change here.
export function pipe<A>(value: A): A;
export function pipe<A, B>(value: A, ab: (a: A) => B): B;
export function pipe<A, B, C>(value: A, ab: (a: A) => B, bc: (b: B) => C): C;
export function pipe<A, B, C, D>(
  value: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
): D;
export function pipe(
  value: unknown,
  ...fns: Array<(arg: unknown) => unknown>
): unknown {
  return fns.reduce((acc, fn) => fn(acc), value);
}

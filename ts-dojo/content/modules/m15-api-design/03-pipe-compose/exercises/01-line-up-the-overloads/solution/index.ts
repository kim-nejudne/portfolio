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

export function compose<A, B>(ab: (a: A) => B): (a: A) => B;
export function compose<A, B, C>(bc: (b: B) => C, ab: (a: A) => B): (a: A) => C;
export function compose(
  ...fns: Array<(arg: unknown) => unknown>
): (arg: unknown) => unknown {
  return (value) => fns.reduceRight((acc, fn) => fn(acc), value);
}

// Don't change anything below this line.

export const slug = pipe(
  '  Hello Typed World ',
  (text) => text.trim().toLowerCase().split(' '),
  (words) => words.join('-'),
);

export const price = pipe(
  1950,
  (cents) => cents / 100,
  (amount) => amount.toFixed(2),
  (text) => text.padStart(8, ' '),
);

export const shout = compose(
  (text: string) => `${text.toUpperCase()}!`,
  (n: number) => n.toFixed(1),
);

export const loud = shout(2.5);

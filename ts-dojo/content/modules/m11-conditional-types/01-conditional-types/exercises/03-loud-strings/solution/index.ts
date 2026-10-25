// Loud<T>: every string property of T in capitals, every other property as it is.
// In the true branch T[K] is known to be a string, so Uppercase accepts it.
export type Loud<T> = {
  [K in keyof T]: T[K] extends string ? Uppercase<T[K]> : T[K];
};

type Greeting = { readonly text: 'hello'; times: 3 };

export const greeting: Loud<Greeting> = { text: 'HELLO', times: 3 };

// Loud<T>: every string property of T in capitals, every other property as it is.
export type Loud<T> = { [K in keyof T]: Uppercase<T[K]> };

type Greeting = { readonly text: 'hello'; times: 3 };

export const greeting: Loud<Greeting> = { text: 'HELLO', times: 3 };

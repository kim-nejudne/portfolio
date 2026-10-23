// T is the inputs, as a tuple when the call allows. readonly [...T] makes an array literal
// infer a tuple and accepts as const arrays, and T itself comes out without the readonly. The
// mapped type keeps T a tuple (or an array) and unwraps each element.
export declare function PromiseAll<T extends readonly unknown[]>(
  values: readonly [...T],
): Promise<{ [K in keyof T]: Awaited<T[K]> }>;

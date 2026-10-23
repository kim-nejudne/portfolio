type Segments<P extends string> = P extends `${infer Head}/${infer Rest}`
  ? Head | Segments<Rest>
  : P;
type ParamName<S> = S extends `:${infer Name}` ? Name : never;

// The parameters of a route pattern. A pattern known only as `string` takes any record of strings.
export type Params<P extends string> = string extends P
  ? Record<string, string>
  : { [K in ParamName<Segments<P>>]: string };

// The arguments after the pattern: nothing when it has no parameters, its parameters otherwise.
export type HrefArgs<P extends string> = [params?: Params<P>];

// The pattern with each `:name` segment replaced by its encoded value.
export function href<P extends string>(
  pattern: P,
  ...args: HrefArgs<P>
): string {
  throw new Error(`href is not written yet: ${pattern}, ${args.length}`);
}

// A route table whose patterns keep their literal types, and a link builder over it.
export function defineRoutes<R extends Record<string, string>>(routes: R) {
  return {
    routes,
    link<N extends keyof R>(name: N, ...args: HrefArgs<R[N]>): string {
      throw new Error(
        `link is not written yet: ${String(name)}, ${args.length}`,
      );
    },
  };
}

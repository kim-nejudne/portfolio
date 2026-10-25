type Segments<P extends string> = P extends `${infer Head}/${infer Rest}`
  ? Head | Segments<Rest>
  : P;

type RequiredName<S> = S extends `:${string}?`
  ? never
  : S extends `:${infer Name}`
    ? Name
    : S extends '*'
      ? '*'
      : never;
type OptionalName<S> = S extends `:${infer Name}?` ? Name : never;

type Simplify<T> = { [K in keyof T]: T[K] };

// The parameters of a route pattern: `:name` is required, `:name?` optional, `*` required.
export type Params<P extends string> = Simplify<
  { [K in RequiredName<Segments<P>>]: string } & {
    [K in OptionalName<Segments<P>>]?: string;
  }
>;

// The arguments after the pattern: nothing, an optional object, or a required object.
export type HrefArgs<P extends string> = [params?: Params<P>];

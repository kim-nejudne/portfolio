type Segments<P extends string> = P extends `${infer Head}/${infer Rest}`
  ? Head | Segments<Rest>
  : P;
type ParamName<S> = S extends `:${infer Name}` ? Name : never;
// Only a `*` that ends the pattern is a wildcard; a `*` anywhere else is plain text.
type Wildcard<P extends string> = P extends `${string}/*` ? '*' : never;

// The parameters of a route pattern: a string for each `:name`, and one for a trailing `*`.
export type Params<P extends string> = {
  [K in ParamName<Segments<P>> | Wildcard<P>]: string;
};

export type Values = Partial<Record<string, string>>;

// True when every parameter of the pattern, a trailing `*` included, has a value.
export function hasParams<P extends string>(
  pattern: P,
  values: Values,
): values is Params<P> {
  throw new Error(
    `hasParams is not written yet: ${pattern}, ${Object.keys(values).length}`,
  );
}

// The parameters of the pathname when it matches the pattern; null otherwise.
export function matchPath<P extends string>(
  pattern: P,
  pathname: string,
): Params<P> | null {
  throw new Error(`matchPath is not written yet: ${pattern}, ${pathname}`);
}

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
  const segments = pattern.split('/');
  return segments.every((segment, i) => {
    if (segment.startsWith(':')) return values[segment.slice(1)] !== undefined;
    if (segment === '*' && i === segments.length - 1) {
      return values['*'] !== undefined;
    }
    return true;
  });
}

// The parameters of the pathname when it matches the pattern; null otherwise.
export function matchPath<P extends string>(
  pattern: P,
  pathname: string,
): Params<P> | null {
  const want = pattern.split('/');
  const got = pathname.split('/');
  const values: Values = {};
  for (const [i, segment] of want.entries()) {
    if (segment === '*' && i === want.length - 1) {
      // The wildcard takes the rest of the pathname, as it is.
      values['*'] = got.slice(i).join('/');
      return hasParams(pattern, values) ? values : null;
    }
    const part = got[i];
    if (part === undefined) return null;
    if (segment.startsWith(':') && part !== '') {
      values[segment.slice(1)] = decodeURIComponent(part);
    } else if (segment !== part) {
      return null;
    }
  }
  if (want.length !== got.length) return null;
  return hasParams(pattern, values) ? values : null;
}

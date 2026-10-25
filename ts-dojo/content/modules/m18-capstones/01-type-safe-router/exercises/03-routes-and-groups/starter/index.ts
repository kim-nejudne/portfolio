import { z } from 'zod';

type Segments<P extends string> = P extends `${infer Head}/${infer Rest}`
  ? Head | Segments<Rest>
  : P;
type ParamName<S> = S extends `:${infer Name}` ? Name : never;
type Wildcard<P extends string> = P extends `${string}/*` ? '*' : never;

// The parameters of a route pattern: a string for each `:name`, and one for a trailing `*`.
export type Params<P extends string> = {
  [K in ParamName<Segments<P>> | Wildcard<P>]: string;
};

type Values = Partial<Record<string, string>>;

function hasParams<P extends string>(
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

// Exercise 1's matcher.
export function matchPath<P extends string>(
  pattern: P,
  pathname: string,
): Params<P> | null {
  const want = pattern.split('/');
  const got = pathname.split('/');
  const values: Values = {};
  for (const [i, segment] of want.entries()) {
    if (segment === '*' && i === want.length - 1) {
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

// The query string as an object of strings.
export type Query = Partial<Record<string, string>>;

// A schema for the query: what it takes in must be strings, as a URL's query is.
export type SearchSchema = z.ZodType<unknown, Query>;

export type RouteResult<R> =
  { ok: true; value: R } | { ok: false; issues: z.core.$ZodIssue[] };

// A route as the router sees it: its pattern, and a way to run it on a pathname and a query.
export interface Route<P extends string, R> {
  readonly path: P;
  resolve(pathname: string, query: Query): RouteResult<R> | null;
}

// Untyped for now: make the handler's params come from the path, its search from the schema.
interface RouteDef {
  path: string;
  search: z.ZodType;
  handle(ctx: { params: Record<string, string>; search: unknown }): unknown;
}

export function route(def: RouteDef): Route<string, unknown> {
  throw new Error(`route is not written yet: ${def.path}`);
}

// Routes under a common prefix, whose handlers see the prefix's parameters too.
export interface Group {
  route(def: RouteDef): Route<string, unknown>;
  group(base: string): Group;
}

export function group(base: string): Group {
  throw new Error(`group is not written yet: ${base}`);
}

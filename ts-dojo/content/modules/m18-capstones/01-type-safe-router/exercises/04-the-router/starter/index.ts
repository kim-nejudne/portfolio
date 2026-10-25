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

// Exercise 3's route: the handler's params come from the path, its search from the schema.
// `NoInfer` keeps a place that expects a `Route<string, …>` from widening `P` to `string`.
export function route<P extends string, S extends SearchSchema, R>(def: {
  path: P;
  search: S;
  handle(ctx: { params: Params<P>; search: z.output<S> }): R;
}): Route<NoInfer<P>, R> {
  return {
    path: def.path,
    resolve(pathname, query) {
      const params = matchPath(def.path, pathname);
      if (params === null) return null;
      const search = def.search.safeParse(query);
      if (!search.success) return { ok: false, issues: search.error.issues };
      return { ok: true, value: def.handle({ params, search: search.data }) };
    },
  };
}

// Routes under a common prefix, whose handlers see the prefix's parameters too.
export interface Group<B extends string> {
  route<P extends string, S extends SearchSchema, R>(def: {
    path: P;
    search: S;
    handle(ctx: { params: Params<`${B}${P}`>; search: z.output<S> }): R;
  }): Route<`${B}${P}`, R>;
  group<C extends string>(base: C): Group<`${B}${C}`>;
}

export function group<B extends string>(base: B): Group<B> {
  return {
    route(def) {
      return route({ ...def, path: `${base}${def.path}` });
    },
    group(inner) {
      return group(`${base}${inner}`);
    },
  };
}

// 15.4's link arguments: nothing for a pattern without parameters, its parameters otherwise.
export type HrefArgs<P extends string> = keyof Params<P> extends never
  ? []
  : [params: Params<P>];

// The pattern with each parameter filled in: `:name` values encoded, a trailing `*` as it is.
export function href<P extends string>(
  pattern: P,
  ...args: HrefArgs<P>
): string {
  const [params] = args;
  const values: Values = params ?? {};
  const segments = pattern.split('/');
  return segments
    .map((segment, i) => {
      const wildcard = segment === '*' && i === segments.length - 1;
      if (!wildcard && !segment.startsWith(':')) return segment;
      const value = values[wildcard ? '*' : segment.slice(1)];
      if (value === undefined) throw new Error(`missing ${segment}`);
      return wildcard ? value : encodeURIComponent(value);
    })
    .join('/');
}

// '/search?q=type+script&page=2' gives '/search' and { q: 'type script', page: '2' }.
export function splitUrl(url: string): { pathname: string; query: Query } {
  const mark = url.indexOf('?');
  const pathname = mark === -1 ? url : url.slice(0, mark);
  const query: Query = {};
  if (mark === -1) return { pathname, query };
  for (const pair of url.slice(mark + 1).split('&')) {
    if (pair === '') continue;
    const [key = '', value = ''] = pair
      .split('=')
      .map((part) => decodeURIComponent(part.replaceAll('+', ' ')));
    query[key] = value;
  }
  return { pathname, query };
}

// What the router made of a URL. `N` is the union of the route names.
export type Outcome<N extends string> =
  | { kind: 'page'; name: N; body: string }
  | { kind: 'bad-query'; name: N; issues: z.core.$ZodIssue[] }
  | { kind: 'not-found'; pathname: string };

export interface Reply {
  status: 200 | 400 | 404;
  body: string;
}

// Untyped for now: type the outcome's names, and href's and navigate's arguments, from `routes`.
export function createRouter(routes: Record<string, Route<string, unknown>>) {
  return {
    resolve(url: string): Outcome<string> {
      throw new Error(
        `resolve is not written yet: ${url}, ${Object.keys(routes).length}`,
      );
    },
    href(name: string, ...args: [params?: Record<string, string>]): string {
      throw new Error(`href is not written yet: ${name}, ${args.length}`);
    },
    navigate(
      name: string,
      ...args: [params?: Record<string, string>]
    ): Outcome<string> {
      throw new Error(`navigate is not written yet: ${name}, ${args.length}`);
    },
  };
}

// The reply for an outcome: 200, 400 or 404.
export function respond(outcome: Outcome<string>): Reply {
  throw new Error(`respond is not written yet: ${outcome.kind}`);
}

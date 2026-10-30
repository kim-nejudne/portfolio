// A minimal client router: the four routes, their params, `navigate` and `Link`. It replaces
// react-router, which was about 12 KB of the player page's 120 KB gzipped budget for features the
// app never used (spec: Performance budget; DECISIONS 61).

import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

export type Params = Partial<Record<string, string>>;

interface Location {
  pathname: string;
  navigate(to: string): void;
}

const LocationContext = createContext<Location | null>(null);
const ParamsContext = createContext<Params>({});

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * The params of `pattern` (`/play/:code`) in `pathname`, or null when it doesn't match. Every
 * segment must match, and one trailing slash is allowed.
 */
export function matchPath(pattern: string, pathname: string): Params | null {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const want = pattern.split('/');
  const got = path.split('/');
  if (want.length !== got.length) return null;
  const params: Params = {};
  for (let i = 0; i < want.length; i++) {
    const w = want[i]!;
    const g = got[i]!;
    if (w.startsWith(':')) {
      if (g === '') return null;
      params[w.slice(1)] = decode(g);
    } else if (w !== g) return null;
  }
  return params;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

function browserNavigate(to: string) {
  window.history.pushState(null, '', to);
  for (const listener of listeners) listener();
}

/** The address bar's path. Back and forward re-render through `popstate`. */
export function BrowserRouter({ children }: { children: ReactNode }) {
  const pathname = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => '/',
  );
  const location = useMemo(() => ({ pathname, navigate: browserNavigate }), [pathname]);
  return <LocationContext value={location}>{children}</LocationContext>;
}

/** A router held in state, for tests. */
export function MemoryRouter({
  initialEntries = ['/'],
  children,
}: {
  initialEntries?: string[];
  children: ReactNode;
}) {
  const [pathname, setPathname] = useState(() => initialEntries[0]!.split('?')[0]!);
  const navigate = useCallback((to: string) => setPathname(to.split('?')[0]!), []);
  const location = useMemo(() => ({ pathname, navigate }), [pathname, navigate]);
  return <LocationContext value={location}>{children}</LocationContext>;
}

function useLocation(): Location {
  const location = useContext(LocationContext);
  if (!location) throw new Error('Router hooks need a BrowserRouter or MemoryRouter.');
  return location;
}

export function useNavigate(): (to: string) => void {
  return useLocation().navigate;
}

/** The params of the route being rendered (empty outside one). */
export function useParams(): Params {
  return useContext(ParamsContext);
}

interface RouteProps {
  path: string;
  element: ReactNode;
}

/** Declares a route for `Routes`; renders nothing itself. */
export function Route(props: RouteProps): null {
  void props;
  return null;
}

/** Renders the first child `Route` whose path matches, or nothing. */
export function Routes({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child) || child.type !== Route) continue;
    const { path, element } = (child as ReactElement<RouteProps>).props;
    const params = matchPath(path, pathname);
    if (params) return <ParamsContext value={params}>{element}</ParamsContext>;
  }
  return null;
}

/** A link that navigates in the page on a plain click, and acts as a normal link otherwise. */
export function Link({ to, onClick, ...rest }: ComponentProps<'a'> & { to: string }) {
  const navigate = useNavigate();
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey ||
      (rest.target && rest.target !== '_self')
    )
      return;
    event.preventDefault();
    navigate(to);
  };
  return <a href={to} {...rest} onClick={click} />;
}

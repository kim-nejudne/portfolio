/**
 * The paths the client router answers, in one place, because two processes
 * need to agree about them.
 *
 * `App.tsx` renders a `<Route>` per entry and a `*` that renders `NotFoundView`.
 * That is enough for the browser — but the *server* has to decide a status code
 * before React exists, and it was getting that wrong for every request it had
 * never heard of.
 *
 * `server.ts` used to answer any unmatched path with `dist/index.html` at status
 * **200**. So `/zzz-nope` returned the app, and the app rendered its own
 * not-found screen, and the response said "this page is fine" to everything that
 * reads a status rather than a body — crawlers first among them. There was no
 * 404 anywhere on the site, and a crawler can index unlimited duplicate URLs off
 * that. PLINTH's craft pass found the same defect in its nginx config and fixed
 * it; nothing carried the lesson here.
 *
 * The list is small and stable, and it is exported rather than duplicated so
 * `App.tsx` and `server.ts` cannot drift into disagreeing about what exists.
 */

/**
 * Paths matched exactly.
 *
 * An object rather than a bare array so `App.tsx` can render
 * `<Route path={ROUTES.menu}>` and the sharing is real: a route added to the
 * app without a line here would have no path to render at, rather than
 * silently answering 404 while working perfectly in the browser — which is the
 * failure a list the server merely *describes* would allow.
 */
export const ROUTES = {
  home: '/',
  menu: '/menu',
  story: '/story',
  visit: '/visit',
  reserve: '/reserve',
  confirmation: '/confirmation',
} as const;

/**
 * Paths matched as a prefix, because the client router owns everything beneath
 * them. `/staff/*` is a nested router: `/staff`, `/staff/reservations` and
 * anything else under it are all the dashboard.
 */
export const ROUTE_PREFIXES = { staff: '/staff' } as const;

/**
 * Is this a path the app is prepared to render?
 *
 * Trailing slashes are tolerated because a browser or a link can add one and
 * the router treats `/menu/` as `/menu`; the server should not disagree with it
 * about that.
 */
/**
 * The subset a crawler should be told about — `scripts/seo.mjs` writes these
 * into `public/sitemap.xml`.
 *
 * Two deliberate omissions, and both are the reason this is its own list rather
 * than `Object.values(ROUTES)`:
 *
 * - **`/confirmation`** renders a booking looked up from a `?token=` in the
 *   query string. Without one it has nothing to show, so the bare path is an
 *   empty page and listing it invites a crawler to index it as one.
 * - **`/staff`** is the back-of-house console. It is not secret — the gate is
 *   server-side and a PIN, not obscurity — but it is not a page anybody should
 *   arrive at from a search result.
 */
export const SITEMAP_ROUTES = [
  ROUTES.home,
  ROUTES.menu,
  ROUTES.story,
  ROUTES.visit,
  ROUTES.reserve,
] as const;

export function isAppRoute(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') || '/' : pathname;
  if (Object.values(ROUTES).some((r) => r === path)) return true;
  return Object.values(ROUTE_PREFIXES).some((p) => path === p || path.startsWith(`${p}/`));
}

import { NextResponse, type NextRequest } from 'next/server';

/**
 * Redirects signed-out visitors away from the four gated surfaces.
 *
 * **This is not the security boundary, and it must not be mistaken for one.**
 * It checks only that a session cookie is *present* — it does not verify the
 * signature, and a forged `forme_access=anything` walks straight past it. The
 * real checks are, in order:
 *
 *   1. the API, which verifies the JWT on every request and scopes every read
 *      to the caller's role and account;
 *   2. each route group's `layout.tsx`, which resolves the session server-side
 *      through `/auth/me` and renders a gate notice rather than data.
 *
 * What this adds is the thing neither of those can: a redirect instead of a
 * 200 with a notice on it. A signed-out visitor lands on the sign-in form with
 * somewhere to go back to, rather than on a page that looks broken.
 *
 * Verifying the token here was the alternative, and it was rejected: it would
 * put `JWT_SECRET` into the web tier, which currently has no signing key at
 * all and is better for it. A second copy of an auth secret is a worse trade
 * than a redirect that is occasionally optimistic.
 */

/** The cookie the API sets. Presence only — never trusted for its contents. */
const SESSION_COOKIE = 'forme_access';

const GATED_PREFIXES = ['/app', '/prepress', '/floor', '/admin'];

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  const isGated = GATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isGated) return NextResponse.next();

  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const signIn = new URL('/sign-in', request.url);
  /**
   * Where to return to after signing in. Stored as a path, and validated again
   * on the way out — an absolute URL here would turn the sign-in form into an
   * open redirect.
   */
  signIn.searchParams.set('next', `${pathname}${search}`);

  const response = NextResponse.redirect(signIn);
  // A cached redirect would follow the next visitor around after they sign in.
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {
  /**
   * Node runtime, not edge. Everything here is self-hosted behind nginx on a
   * droplet — there is no edge network to run on, and keeping one runtime
   * means one set of APIs and one thing to reason about.
   */
  runtime: 'nodejs',
  /**
   * Only the gated prefixes. Running middleware on every request, including
   * every static asset, is latency spent on routes that will never redirect.
   */
  matcher: ['/app/:path*', '/prepress/:path*', '/floor/:path*', '/admin/:path*'],
};

import type { CookieOptions, Response } from 'express';

export const ACCESS_COOKIE = 'forme_access';
export const REFRESH_COOKIE = 'forme_refresh';

/**
 * Both tokens are httpOnly, so no script can read them and an XSS bug cannot
 * walk off with a session. SameSite=Lax rather than Strict because the web app
 * links into itself from external pages (a shared quote, an email) and Strict
 * would drop the cookie on those top-level navigations.
 *
 * `secure` follows NODE_ENV: on the droplet nginx terminates TLS so the cookie
 * must be secure, but forcing it in development would mean no cookie survives
 * http://localhost and nothing works.
 */
function baseOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
  };
}

export function setAuthCookies(
  response: Response,
  tokens: { accessToken: string; refreshToken: string },
  options: { isProduction: boolean; accessMaxAgeMs: number; refreshMaxAgeMs: number },
): void {
  const base = baseOptions(options.isProduction);
  response.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: options.accessMaxAgeMs,
  });
  response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    // Scoped to the refresh endpoint only, so the long-lived token is not
    // attached to every request the app makes.
    path: '/auth',
    maxAge: options.refreshMaxAgeMs,
  });
}

export function clearAuthCookies(response: Response, isProduction: boolean): void {
  const base = baseOptions(isProduction);
  response.clearCookie(ACCESS_COOKIE, base);
  response.clearCookie(REFRESH_COOKIE, { ...base, path: '/auth' });
}

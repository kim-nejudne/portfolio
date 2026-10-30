import express, {
  type ErrorRequestHandler,
  type Request,
  type RequestHandler,
  type Response,
  type Router,
} from 'express';
import {
  ADMIN_COOKIE,
  ADMIN_RATE_LIMITED_ERROR,
  ADMIN_WRONG_PASSWORD_ERROR,
} from '../shared/constants.js';
import { adminLoginBodySchema } from '../shared/schemas.js';
import type { AdminSessionResponse, HttpErrorBody } from '../shared/types.js';
import { adminCookie, verifyAdminPassword, type AdminSessions } from './admin.js';
import type { AdminPasswordHash } from './env.js';
import type { RateLimiter } from './rateLimit.js';

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ ok: false, error } satisfies HttpErrorBody);
}

/** Where the cookie goes, and the path a sign-out must name to clear it. */
const COOKIE_PATH = '/api/admin';

/**
 * Admin writes come only from this site's own pages (Security): a same-origin `Origin`, which every
 * browser sends on a POST, and a JSON content type, which a cross-site form cannot send without a
 * CORS preflight the server never answers. The cookie's SameSite=Strict is the first line; this is the second.
 */
const requireWrite: RequestHandler = (req, res, next) => {
  if (req.get('origin') !== `${req.protocol}://${req.get('host')}`) {
    return sendError(res, 403, 'Admin changes must come from this site.');
  }
  if (!/^application\/json\s*(;|$)/i.test(req.get('content-type') ?? '')) {
    return sendError(res, 415, 'Admin changes must be sent as JSON.');
  }
  next();
};

/**
 * `/api/admin/*`, mounted only when `ADMIN_PASSWORD_HASH` is set (F105). Later admin routes go behind
 * `requireAdmin`, and writes behind `requireWrite` as well.
 */
export function adminRoutes(
  password: AdminPasswordHash,
  sessions: AdminSessions,
  loginLimiter: RateLimiter,
  clock: () => number,
): Router {
  const router = express.Router();

  // Nothing an admin route answers belongs in a cache.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  /** The signed-in session's end, in `res.locals.adminExpiresAt`, or 401. */
  const requireAdmin: RequestHandler = (req, res, next) => {
    const token = adminCookie(req.get('cookie'));
    const expiresAt = token === undefined ? null : sessions.check(token, clock());
    if (expiresAt === null) return sendError(res, 401, 'Sign in as admin first.');
    res.locals.adminExpiresAt = expiresAt;
    next();
  };

  // Every attempt counts against the limit, right or wrong, before the body is even read.
  const limitLogin: RequestHandler = (req, res, next) => {
    if (loginLimiter.hit(req.ip ?? 'unknown')) return next();
    sendError(res, 429, ADMIN_RATE_LIMITED_ERROR);
  };

  const login: RequestHandler = async (req: Request, res: Response) => {
    const parsed = adminLoginBodySchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, 'Send the admin password.');
    if (!(await verifyAdminPassword(parsed.data.password, password))) {
      return sendError(res, 401, ADMIN_WRONG_PASSWORD_ERROR);
    }
    // A sign-in over an old session replaces it.
    const previous = adminCookie(req.get('cookie'));
    if (previous !== undefined) sessions.end(previous);
    const now = clock();
    const { token, expiresAt } = sessions.create(now);
    res.cookie(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      path: COOKIE_PATH,
      maxAge: expiresAt - now,
      secure: req.secure,
    });
    res.json({ expiresAt } satisfies AdminSessionResponse);
  };

  const onLoginTooLarge: ErrorRequestHandler = (err: { type?: string }, _req, res, next) => {
    if (err.type !== 'entity.too.large') return next(err);
    sendError(res, 413, 'Send only the admin password.');
  };

  router.post(
    '/login',
    limitLogin,
    requireWrite,
    // A 1024-character password is at most 4 KB of UTF-8.
    express.json({ limit: 8192 }),
    login,
    onLoginTooLarge,
  );

  router.get('/session', requireAdmin, (_req, res) => {
    res.json({ expiresAt: res.locals.adminExpiresAt as number } satisfies AdminSessionResponse);
  });

  // Signing out twice, or with no session, still answers ok: the cookie is gone either way.
  router.post('/logout', requireWrite, (req, res) => {
    const token = adminCookie(req.get('cookie'));
    if (token !== undefined) sessions.end(token);
    res.clearCookie(ADMIN_COOKIE, {
      httpOnly: true,
      sameSite: 'strict',
      path: COOKIE_PATH,
      secure: req.secure,
    });
    res.json({ ok: true });
  });

  router.use((_req, res) => sendError(res, 404, 'Not found.'));

  return router;
}

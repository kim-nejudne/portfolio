// `/api/admin` (F80). Ported from Buzzr (buzzer/server/adminRoutes.ts: `requireWrite`, the session
// check, the sign-in rate limit and cookie) with Sketchy's setup code: setup while no password is
// set, reset whenever a setup code is configured. F81 adds the category routes behind
// `requireAdmin` (and `requireWrite` on writes).
import express, {
  type ErrorRequestHandler,
  type Request,
  type RequestHandler,
  type Response,
  type Router,
} from 'express';
import { ADMIN_COOKIE, ADMIN_PASSWORD_MIN } from '../shared/constants.js';
import { adminLoginBodySchema, adminSetupBodySchema } from '../shared/schemas.js';
import type { AdminOkResponse, AdminStatusResponse, HttpErrorBody } from '../shared/types.js';
import {
  adminCookie,
  hashAdminPassword,
  sameSecret,
  verifyAdminPassword,
  type AdminSessions,
} from './admin.js';
import type { AdminPassword } from './adminPassword.js';
import type { RateLimiter } from './rateLimit.js';

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ ok: false, error } satisfies HttpErrorBody);
}

/** Where the cookie goes, and the path a sign-out must name to clear it. */
const COOKIE_PATH = '/api/admin';

/** Bodies here are a setup code and a password, each at most 4 KB of UTF-8. */
const BODY_LIMIT = 16 * 1024;

export const ADMIN_ERRORS = {
  rateLimited: 'Too many tries. Wait a minute and try again.',
  wrongPassword: 'That password is wrong.',
  wrongSetupCode: 'That setup code is wrong.',
  shortPassword: `Use a password of at least ${ADMIN_PASSWORD_MIN} characters.`,
  setupBody: 'Send the setup code and a new password.',
  loginBody: 'Send the admin password.',
  alreadySet: 'A password is already set. Sign in, or use Forgot password.',
  noPassword: 'No admin password is set yet. Set one up first.',
  noSetupCode: 'Forgot password needs SKETCHY_ADMIN_SETUP_CODE on the server.',
  signIn: 'Sign in as admin first.',
  saveFailed: 'Could not save the password. Try again.',
  notFound: 'Not found.',
  fromThisSite: 'Admin changes must come from this site.',
  asJson: 'Admin changes must be sent as JSON.',
} as const;

/**
 * Admin writes come only from this site's own pages (Security): a same-origin `Origin`, which every
 * browser sends on a POST, and a JSON content type, which a cross-site form cannot send without a
 * CORS preflight the server never answers. The cookie's SameSite=Strict is the first line; this is
 * the second.
 */
export const requireWrite: RequestHandler = (req, res, next) => {
  if (req.get('origin') !== `${req.protocol}://${req.get('host')}`) {
    return sendError(res, 403, ADMIN_ERRORS.fromThisSite);
  }
  if (!/^application\/json\s*(;|$)/i.test(req.get('content-type') ?? '')) {
    return sendError(res, 415, ADMIN_ERRORS.asJson);
  }
  next();
};

/** A body too large or not JSON answers with a readable error, not Express's HTML page. */
const onBodyError =
  (bodyError: string): ErrorRequestHandler =>
  (err: { type?: string }, _req, res, next) => {
    if (err.type === 'entity.too.large') return sendError(res, 413, bodyError);
    if (err.type === 'entity.parse.failed') return sendError(res, 400, bodyError);
    next(err);
  };

export interface AdminRoutesOptions {
  /** `SKETCHY_ADMIN_SETUP_CODE`, or null. */
  setupCode: string | null;
  /** The hash in `DATA_DIR/admin.env`. */
  password: AdminPassword;
  sessions: AdminSessions;
  /** Setup, reset and sign-in share this limiter (5 per IP per minute). */
  limiter: RateLimiter;
  clock: () => number;
  /** scrypt costs for new hashes; tests pass cheap ones. */
  hash?: (password: string) => Promise<string>;
  /** Checks a password against a hash; tests hold one open to race a reset. */
  verify?: typeof verifyAdminPassword;
}

/**
 * The `/api/admin` router. With no setup code and no password hash, everything but `status` is 404.
 * The hash can appear at run time (setup), so that is checked per request.
 */
export function adminRoutes({
  setupCode,
  password,
  sessions,
  limiter,
  clock,
  hash = hashAdminPassword,
  verify = verifyAdminPassword,
}: AdminRoutesOptions): Router {
  const router = express.Router();

  // Nothing an admin route answers belongs in a cache.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  const configured = () => setupCode !== null || password.current() !== null;

  const signedIn = (req: Request) => {
    const token = adminCookie(req.get('cookie'));
    return token !== undefined && sessions.check(token, clock()) !== null;
  };

  router.get('/status', (req, res) => {
    const passwordSet = password.current() !== null;
    res.json({
      configured: configured(),
      passwordSet,
      signedIn: passwordSet && signedIn(req),
    } satisfies AdminStatusResponse);
  });

  // Not configured: the admin doesn't exist, so every other path is 404, writes included.
  router.use((_req, res, next) => {
    if (configured()) return next();
    sendError(res, 404, ADMIN_ERRORS.notFound);
  });

  // Every attempt counts against the limit, right or wrong, before the body is even read, and
  // before the write guard, as in Buzzr.
  // SPEC-QUESTION: a request the write guard refuses still spends one of the 5 tries (DECISIONS 106).
  const limit: RequestHandler = (req, res, next) => {
    if (limiter.hit(req.ip ?? 'unknown')) return next();
    sendError(res, 429, ADMIN_ERRORS.rateLimited);
  };

  /** A fresh session for this browser, replacing the one its cookie names. */
  function signIn(req: Request, res: Response): void {
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
  }

  /** Setup and reset: check the code, hash the new password, save it, sign everyone else out. */
  const newPassword =
    (mode: 'setup' | 'reset'): RequestHandler =>
    async (req, res) => {
      if (setupCode === null) {
        // Configured by a hash alone: there is no code to check.
        return sendError(res, mode === 'setup' ? 404 : 409, ADMIN_ERRORS.noSetupCode);
      }
      if (mode === 'setup' && password.current() !== null) {
        return sendError(res, 409, ADMIN_ERRORS.alreadySet);
      }
      const parsed = adminSetupBodySchema.safeParse(req.body);
      if (!parsed.success) {
        const short = parsed.error.issues.some(
          (issue) => issue.path[0] === 'password' && issue.code === 'too_small',
        );
        return sendError(res, 400, short ? ADMIN_ERRORS.shortPassword : ADMIN_ERRORS.setupBody);
      }
      if (!sameSecret(parsed.data.setupCode, setupCode)) {
        return sendError(res, 401, ADMIN_ERRORS.wrongSetupCode);
      }
      let saved: boolean;
      try {
        saved = await password.save(await hash(parsed.data.password), {
          onlyIfUnset: mode === 'setup',
        });
      } catch {
        // The error may name the data folder; the hash is never in it.
        console.error(`Admin ${mode}: could not write ${password.path}`);
        return sendError(res, 500, ADMIN_ERRORS.saveFailed);
      }
      // Another setup won the race: this one changed nothing.
      if (!saved) return sendError(res, 409, ADMIN_ERRORS.alreadySet);
      sessions.endAll();
      signIn(req, res);
      console.log(`Admin password ${mode === 'setup' ? 'set' : 'reset'}; other sessions ended.`);
      res.json({ ok: true } satisfies AdminOkResponse);
    };

  router.post(
    '/setup',
    limit,
    requireWrite,
    express.json({ limit: BODY_LIMIT }),
    newPassword('setup'),
    onBodyError(ADMIN_ERRORS.setupBody),
  );

  router.post(
    '/reset',
    limit,
    requireWrite,
    express.json({ limit: BODY_LIMIT }),
    newPassword('reset'),
    onBodyError(ADMIN_ERRORS.setupBody),
  );

  router.post(
    '/login',
    limit,
    requireWrite,
    express.json({ limit: BODY_LIMIT }),
    async (req: Request, res: Response) => {
      const stored = password.current();
      if (stored === null) return sendError(res, 409, ADMIN_ERRORS.noPassword);
      const parsed = adminLoginBodySchema.safeParse(req.body);
      if (!parsed.success) return sendError(res, 400, ADMIN_ERRORS.loginBody);
      // A reset that lands while scrypt runs ends every session and replaces the hash: a sign-in
      // with the old password must not outlive it.
      if (!(await verify(parsed.data.password, stored)) || password.current() !== stored) {
        return sendError(res, 401, ADMIN_ERRORS.wrongPassword);
      }
      signIn(req, res);
      res.json({ ok: true } satisfies AdminOkResponse);
    },
    onBodyError(ADMIN_ERRORS.loginBody),
  );

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
    res.json({ ok: true } satisfies AdminOkResponse);
  });

  // F81 mounts its category routes here, behind a session check (401 `ADMIN_ERRORS.signIn` when
  // `signedIn(req)` is false) and `requireWrite` on writes.

  router.use((_req, res) => sendError(res, 404, ADMIN_ERRORS.notFound));

  return router;
}

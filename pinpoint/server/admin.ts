import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import express, {
  type ErrorRequestHandler,
  type RequestHandler,
  type Response,
  type Router,
} from 'express';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_BYTES,
  ADMIN_SESSION_MS,
  RATE_LIMITS,
} from '#shared/constants.js';
import {
  adminLoginBodySchema,
  categoryEmojiBodySchema,
  categoryMetaBodySchema,
  generateBodySchema,
  generateMoreBodySchema,
  hiddenBodySchema,
  jobsQuerySchema,
  levelParamSchema,
  placeAddByIdBodySchema,
  placeEditBodySchema,
  placeParamSchema,
  regenerateBodySchema,
  reviewedBodySchema,
  wikidataSearchQuerySchema,
} from '#shared/schemas.js';
import type {
  AdminCategoriesResponse,
  AdminCategoryResponse,
  AdminJobResponse,
  AdminJobsResponse,
  AdminPublishResponse,
  AdminSessionResponse,
  AdminWikidataSearchResponse,
  Category,
} from '#shared/types.js';
import { z } from 'zod';
import {
  adminRow,
  CategoryStoreError,
  draftBoxAndStyle,
  wikidataIds,
  type CategoryStore,
} from './categoryStore.js';
import { scryptMaxmem, type AdminPasswordHash } from './env.js';
import type { JobRequest, JobRunner } from './generate/jobs.js';
import { createResolver } from './generate/resolver.js';
import { WikimediaError, type WikimediaClient } from './generate/wikimedia.js';
import { createRateLimiter, type RateLimiter } from './rateLimit.js';

export const ADMIN_RATE_LIMITED_ERROR = 'Too many tries. Wait a minute and try again.';
export const WIKIDATA_SEARCH_LIMITED_ERROR = 'Too many searches. Wait a minute and try again.';
export const ADMIN_WRONG_PASSWORD_ERROR = 'That password is wrong.';
const NO_SUCH_CATEGORY = 'No such category';
/** Admin change bodies are small: a box, a style, a place edit. */
const ADMIN_BODY_LIMIT = 16384;

/**
 * Whether `password` derives the stored key. scrypt runs off the main thread, and the keys are the
 * same length, so `timingSafeEqual` compares them in constant time.
 */
export function verifyAdminPassword(password: string, stored: AdminPasswordHash): Promise<boolean> {
  const { N, r, p, salt, hash } = stored;
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFC'),
      salt,
      hash.length,
      { N, r, p, maxmem: scryptMaxmem(stored) },
      (err, key) => (err ? reject(err) : resolve(timingSafeEqual(key, hash))),
    );
  });
}

function sha256(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Admin sessions in memory (spec: Admin access): the raw token goes only into the cookie, and the
 * map keys on its SHA-256, so a heap dump holds no usable session. A restart signs the admin out.
 */
export class AdminSessions {
  private readonly sessions = new Map<string, number>();

  constructor(private readonly ttlMs = ADMIN_SESSION_MS) {}

  /** A new session: the token for the cookie, and when it ends. */
  create(now: number): { token: string; expiresAt: number } {
    this.prune(now);
    const token = randomBytes(ADMIN_SESSION_BYTES).toString('base64url');
    const expiresAt = now + this.ttlMs;
    this.sessions.set(sha256(token), expiresAt);
    return { token, expiresAt };
  }

  /** When the session ends, or null for an unknown or expired token. */
  check(token: string, now: number): number | null {
    const key = sha256(token);
    const expiresAt = this.sessions.get(key);
    if (expiresAt === undefined) return null;
    if (now >= expiresAt) {
      this.sessions.delete(key);
      return null;
    }
    return expiresAt;
  }

  /** Signs out. An unknown token is ignored. */
  end(token: string): void {
    this.sessions.delete(sha256(token));
  }

  /** Drops every expired session. Sign-ins are rate-limited, so running this on each one is enough. */
  private prune(now: number): void {
    for (const [key, expiresAt] of this.sessions) {
      if (now >= expiresAt) this.sessions.delete(key);
    }
  }
}

/** The `pinpoint_admin` value from a `Cookie` header, or undefined. */
export function adminCookie(header: string | undefined): string | undefined {
  for (const pair of (header ?? '').split(';')) {
    const at = pair.indexOf('=');
    if (at !== -1 && pair.slice(0, at).trim() === ADMIN_COOKIE) return pair.slice(at + 1).trim();
  }
  return undefined;
}

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ error });
}

/** Where the cookie goes, and the path a sign-out must name to clear it. */
const COOKIE_PATH = '/api/admin';

/**
 * Admin writes come only from this site's own pages: a same-origin `Origin`, which every browser
 * sends on a POST, and a JSON content type, which a cross-site form cannot send without a CORS
 * preflight the server never answers. The cookie's SameSite=Strict is the first line; this is the second.
 * Building the expected origin from `Host` is safe: a cross-site page can't set `Origin` to match it.
 */
export const requireWrite: RequestHandler = (req, res, next) => {
  if (req.get('origin') !== `${req.protocol}://${req.get('host')}`) {
    return sendError(res, 403, 'Admin changes must come from this site.');
  }
  if (!/^application\/json\s*(;|$)/i.test(req.get('content-type') ?? '')) {
    return sendError(res, 415, 'Admin changes must be sent as JSON.');
  }
  next();
};

export interface AdminRouteOptions {
  password: AdminPasswordHash;
  sessions: AdminSessions;
  loginLimiter: RateLimiter;
  clock: () => number;
  categories: CategoryStore;
  /** The shared Wikimedia client; throws a WikimediaError while it can't exist (no contact). */
  wikimedia: () => WikimediaClient;
  /** Generation jobs, queue and daily limits. */
  jobs: JobRunner;
}

/**
 * `/api/admin/*`, mounted only when `ADMIN_PASSWORD_HASH` is set. Later admin routes (F31–F45) go
 * on `router` behind `requireAdmin`, and writes behind `requireWrite` as well.
 */
export function adminRoutes({
  password,
  sessions,
  loginLimiter,
  clock,
  categories,
  wikimedia,
  jobs,
}: AdminRouteOptions): {
  router: Router;
  requireAdmin: RequestHandler;
} {
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

  const login: RequestHandler = async (req, res) => {
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

  const onLoginBodyError: ErrorRequestHandler = (err: { type?: string }, _req, res, next) => {
    if (err.type === 'entity.too.large')
      return sendError(res, 413, 'Send only the admin password.');
    if (err.type === 'entity.parse.failed') return sendError(res, 400, 'Send the admin password.');
    next(err);
  };

  router.post(
    '/login',
    limitLogin,
    requireWrite,
    // A 1024-character password is at most 4 KB of UTF-8.
    express.json({ limit: 8192 }),
    login,
    onLoginBodyError,
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

  router.get('/categories', requireAdmin, (_req, res) => {
    res.json({ categories: categories.list().map(adminRow) } satisfies AdminCategoriesResponse);
  });

  router.get('/categories/:id', requireAdmin, (req, res) => {
    const category = categories.find(String(req.params.id));
    if (!category) return sendError(res, 404, NO_SUCH_CATEGORY);
    res.json({ category } satisfies AdminCategoryResponse);
  });

  /** A signed-in, same-origin JSON write to `/categories/:id…` whose body `schema` checks. */
  function categoryWrite<T>(
    method: 'put' | 'post' | 'delete',
    path: string,
    schema: z.ZodType<T>,
    handle: (id: string, body: T, res: Response, params: Record<string, string>) => Promise<void>,
  ): void {
    router[method](
      `/categories/:id${path}`,
      requireAdmin,
      requireWrite,
      express.json({ limit: ADMIN_BODY_LIMIT }),
      async (req, res) => {
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) return sendError(res, 400, parsed.error.issues[0]!.message);
        await handle(String(req.params.id), parsed.data, res, req.params as Record<string, string>);
      },
    );
  }

  const answer = (res: Response, category: Category) =>
    void res.json({ category } satisfies AdminCategoryResponse);
  // Bodiless actions still arrive as JSON (`{}`), which `requireWrite` insists on.
  const empty = z.object({});

  categoryWrite('put', '/meta', categoryMetaBodySchema, async (id, meta, res) =>
    answer(res, await categories.updateMeta(id, meta)),
  );
  categoryWrite('put', '/hidden', hiddenBodySchema, async (id, { hidden }, res) =>
    answer(res, await categories.setHidden(id, hidden)),
  );
  categoryWrite('put', '/emoji', categoryEmojiBodySchema, async (id, { emoji }, res) =>
    answer(res, await categories.setEmoji(id, emoji)),
  );
  // Refused (409, the problems joined by "; ") while a draft level is unreviewed or a place invalid.
  categoryWrite('post', '/publish', empty, async (id, _body, res) => {
    const { category, levels } = await categories.publish(id);
    res.json({ category, levels } satisfies AdminPublishResponse);
  });
  categoryWrite('delete', '', empty, async (id, _body, res) => {
    await categories.remove(id);
    res.json({ ok: true });
  });

  /** The `:level` (and `:placeId`) of a level route, or a 404 answered. */
  function levelParams<S extends typeof levelParamSchema | typeof placeParamSchema>(
    schema: S,
    params: Record<string, string>,
    res: Response,
  ): z.infer<S> | null {
    const parsed = schema.safeParse(params);
    if (parsed.success) return parsed.data as z.infer<S>;
    sendError(res, 404, 'No such level or place');
    return null;
  }
  const PLACE = '/levels/:level/places/:placeId';

  categoryWrite('put', PLACE, placeEditBodySchema, async (id, edit, res, params) => {
    const at = levelParams(placeParamSchema, params, res);
    if (!at) return;
    // SPEC-QUESTION: DECISIONS 42 (Swap photo arrives with Picture mode, F51)
    if (edit.photoCandidate !== undefined) {
      return sendError(res, 400, 'Swap photo is not available yet');
    }
    answer(res, await categories.editPlace(id, at.level, at.placeId, edit));
  });
  categoryWrite('delete', PLACE, empty, async (id, _body, res, params) => {
    const at = levelParams(placeParamSchema, params, res);
    if (at) answer(res, await categories.removePlace(id, at.level, at.placeId));
  });
  categoryWrite(
    'post',
    '/levels/:level/reviewed',
    reviewedBodySchema,
    async (id, body, res, params) => {
      const at = levelParams(levelParamSchema, params, res);
      if (at) answer(res, await categories.setReviewed(id, at.level, body.reviewed));
    },
  );

  // Add by name (spec: Level review): Wikidata only, no LLM, so no daily limit.
  const searchLimiter = createRateLimiter(RATE_LIMITS.wikidataSearch, clock);
  router.get('/wikidata/search', requireAdmin, async (req, res) => {
    if (!searchLimiter.hit(req.ip ?? 'unknown')) {
      return sendError(res, 429, WIKIDATA_SEARCH_LIMITED_ERROR);
    }
    const parsed = wikidataSearchQuerySchema.safeParse(req.query);
    if (!parsed.success) return sendError(res, 400, 'Type a name to search for.');
    if (!categories.find(parsed.data.categoryId)) return sendError(res, 404, NO_SUCH_CATEGORY);
    const candidates = await createResolver(wikimedia()).searchCandidates(parsed.data.q);
    res.json({ candidates } satisfies AdminWikidataSearchResponse);
  });

  // Locate's checks on the admin's pick, with their typed fact. A drop answers 422 with its reason.
  // SPEC-QUESTION: DECISIONS 45 (statuses, the label as the name, no photo until M6)
  // Landmarks get their photo once the photo step exists (M6).
  categoryWrite(
    'post',
    '/levels/:level/places/add-by-id',
    placeAddByIdBodySchema,
    async (id, { kind, wikidataId, fact }, res, params) => {
      const at = levelParams(levelParamSchema, params, res);
      if (!at) return;
      const category = categories.find(id);
      if (!category) return sendError(res, 404, NO_SUCH_CATEGORY);
      const resolution = await createResolver(wikimedia()).resolveById(wikidataId, fact, {
        kind,
        ...draftBoxAndStyle(category),
        existingIds: wikidataIds(category),
      });
      if ('drop' in resolution) return sendError(res, 422, resolution.drop);
      // `addPlace` parses the place, which strips the checker-only `description`.
      answer(res, await categories.addPlace(id, at.level, resolution.place));
    },
  );

  // Generation jobs (spec: Jobs and limits). A refused start answers the runner's status and reason.
  async function startJob(res: Response, request: JobRequest): Promise<void> {
    const started = await jobs.start(request);
    if (!started.ok) return sendError(res, started.status, started.error);
    res.json({ jobId: started.job.id });
  }

  router.post(
    '/categories/generate',
    requireAdmin,
    requireWrite,
    express.json({ limit: ADMIN_BODY_LIMIT }),
    async (req, res) => {
      const parsed = generateBodySchema.safeParse(req.body);
      if (!parsed.success) return sendError(res, 400, parsed.error.issues[0]!.message);
      await startJob(res, { kind: 'generate', ...parsed.data });
    },
  );
  categoryWrite('post', '/generate', generateMoreBodySchema, async (id, body, res) =>
    startJob(res, { kind: 'generate', categoryId: id, name: '', ...body }),
  );
  categoryWrite(
    'post',
    '/levels/:level/regenerate',
    regenerateBodySchema,
    async (id, { count, guidance }, res, params) => {
      const at = levelParams(levelParamSchema, params, res);
      if (!at) return;
      await startJob(res, {
        kind: 'regenerate',
        categoryId: id,
        level: at.level,
        count,
        ...(guidance === undefined ? {} : { guidance }),
      });
    },
  );

  router.get('/jobs', requireAdmin, (req, res) => {
    const parsed = jobsQuerySchema.safeParse(req.query);
    if (!parsed.success) return sendError(res, 400, 'That category id is not valid.');
    res.json({
      jobs: jobs.list(parsed.data.categoryId),
      off: jobs.off,
      levelsLeft: jobs.levelsLeft(),
      replacementsLeft: jobs.replacementsLeft(),
    } satisfies AdminJobsResponse);
  });
  router.get('/jobs/:jobId', requireAdmin, (req, res) => {
    const job = jobs.get(String(req.params.jobId));
    if (!job) return sendError(res, 404, 'There is no job with that id.');
    res.json({ job } satisfies AdminJobResponse);
  });
  router.post(
    '/jobs/:jobId/cancel',
    requireAdmin,
    requireWrite,
    express.json({ limit: ADMIN_BODY_LIMIT }),
    (req, res) => {
      const cancelled = jobs.cancel(String(req.params.jobId));
      if (!cancelled.ok) return sendError(res, cancelled.status, cancelled.error);
      res.json({ job: cancelled.job } satisfies AdminJobResponse);
    },
  );

  // A refused store change answers its own status; a bad body, 400 or 413; anything else is a 500.
  router.use(((err: { type?: string }, _req, res, next) => {
    if (err instanceof CategoryStoreError) return sendError(res, err.status, err.message);
    // Its message carries no key or place text (DECISIONS 43): safe for the admin to read.
    if (err instanceof WikimediaError) return sendError(res, 502, err.message);
    if (err.type === 'entity.too.large') return sendError(res, 413, 'That change is too large.');
    if (err.type === 'entity.parse.failed') return sendError(res, 400, 'Send the change as JSON.');
    next(err);
  }) satisfies ErrorRequestHandler);

  return { router, requireAdmin };
}

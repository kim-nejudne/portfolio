// `/api/admin` (F80). Ported from Buzzr (buzzer/server/adminRoutes.ts: `requireWrite`, the session
// check, the sign-in rate limit and cookie) with Sketchy's setup code: setup while no password is
// set, reset whenever a setup code is configured. F81 adds the category and word routes behind
// the session check (and `requireWrite` on writes); the edits themselves are in adminCategories.ts.
// F83 adds word generation (`/generate…`): jobs and drafts in memory (generate/jobs.ts), saved
// through the same edits.
import express, {
  type ErrorRequestHandler,
  type Request,
  type RequestHandler,
  type Response,
  type Router,
} from 'express';
import type { z } from 'zod';
import {
  ADMIN_BULK_BYTES_MAX,
  ADMIN_COOKIE,
  ADMIN_IMPORT_BYTES_MAX,
  ADMIN_PASSWORD_MIN,
  GENERATE_COUNT_DEFAULT,
  EXPORT_ALL_FILE,
  exportFileName,
} from '../shared/constants.js';
import {
  adminBulkBodySchema,
  adminCategoryCreateBodySchema,
  adminCategoryPatchBodySchema,
  adminDraftSaveBodySchema,
  adminGenerateSchemaFor,
  adminImportQuerySchema,
  adminLoginBodySchema,
  adminSetupBodySchema,
  adminWordBodySchema,
  adminWordPatchBodySchema,
} from '../shared/schemas.js';
import type {
  AdminBulkResponse,
  AdminCategoriesResponse,
  AdminCategory,
  AdminCategoryResponse,
  AdminDraftSaveResponse,
  AdminErrorBody,
  AdminGenerateStatus,
  AdminGenerationResponse,
  AdminImportErrorBody,
  AdminImportResponse,
  AdminOkResponse,
  AdminStatusResponse,
  HttpErrorBody,
} from '../shared/types.js';
import {
  adminCookie,
  hashAdminPassword,
  sameSecret,
  verifyAdminPassword,
  type AdminSessions,
} from './admin.js';
import {
  addBulk,
  addDraftWords,
  createDraftCategory,
  addWord,
  AdminEditError,
  AdminImportError,
  categoryToPack,
  createCategory,
  deleteCategory,
  deleteWord,
  describeIssue,
  importCategory,
  NO_CATEGORY,
  NO_WORD,
  patchCategory,
  patchWord,
} from './adminCategories.js';
import type { AdminPassword } from './adminPassword.js';
import type { Category, CategoryStore } from './categoryStore.js';
import { createGenerationRunner, NO_DRAFT, type GenerationRunner } from './generate/jobs.js';
import { GENERATION_OFF } from './generate/setup.js';
import { packIdSchema } from './packs.js';
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
  notJson: 'Send the change as JSON.',
  tooLarge: 'That is too much at once.',
  importTooLarge: 'That file is over 256 KB. Import one category at a time.',
  importNotJson: 'This file is not valid JSON.',
  editSaveFailed: 'Could not save the change. Try again.',
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
  /** The CategoryStore the editor reads and writes (F81). Without it the category routes are 404. */
  categories?: Pick<CategoryStore, 'read' | 'update' | 'path'>;
  /** Word generation (F83). Without it, generation is off. */
  generation?: GenerationRunner;
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
  categories,
  generation,
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

  if (categories) {
    const requireAdmin: RequestHandler = (req, res, next) => {
      if (signedIn(req)) return next();
      sendError(res, 401, ADMIN_ERRORS.signIn);
    };
    categoryRoutes(
      router,
      categories,
      requireAdmin,
      generation ??
        createGenerationRunner({
          generate: null,
          mode: 'off',
          offMessage: GENERATION_OFF,
          clock,
        }),
    );
  }

  router.use((_req, res) => sendError(res, 404, ADMIN_ERRORS.notFound));

  return router;
}

/** A category as the editor shows it: plain, unfrozen copies. */
function toAdminCategory(c: Category): AdminCategory {
  return {
    id: c.id,
    title: c.title,
    emoji: c.emoji,
    defaultOn: c.defaultOn,
    hidden: c.hidden,
    words: c.words.map((w) => ({
      id: w.id,
      word: w.word,
      alt: [...w.alt],
      difficulty: w.difficulty,
    })),
  };
}

/** A refused body: the first problem, naming its field. */
function sendIssue(res: Response, issues: readonly z.core.$ZodIssue[]): void {
  const { field, message } = describeIssue(issues[0]!);
  res.status(400).json({ ok: false, error: message, field } satisfies AdminErrorBody);
}

/**
 * The category editor (F81; spec: Admin, Category editor). Every route needs a session; every
 * write also passes `requireWrite` and goes through `CategoryStore.update`, which checks the whole
 * file before it writes. Edits show in the next lobby view; a running game keeps its snapshot.
 */
function categoryRoutes(
  router: Router,
  store: Pick<CategoryStore, 'read' | 'update' | 'path'>,
  requireAdmin: RequestHandler,
  generation: GenerationRunner,
): void {
  const json = (limit: number) => express.json({ limit });
  /** Too large and not JSON are different mistakes; both answer JSON. */
  const bodyErrors: ErrorRequestHandler = (err: { type?: string }, _req, res, next) => {
    if (err.type === 'entity.too.large') return sendError(res, 413, ADMIN_ERRORS.tooLarge);
    if (err.type === 'entity.parse.failed') return sendError(res, 400, ADMIN_ERRORS.notJson);
    next(err);
  };

  /** The id in the path, or a 404 sent. */
  const idParam = (res: Response, value: unknown, error: string) => {
    const id = packIdSchema.safeParse(value);
    if (id.success) return id.data;
    sendError(res, 404, error);
    return undefined;
  };

  /**
   * Runs one edit inside the store's queue and answers with what it returns, or with the edit's
   * own refusal. A failed write leaves the file and memory as they were. True when it saved.
   */
  async function edit<T>(
    res: Response,
    run: (current: readonly Category[]) => { categories: readonly Category[]; answer: T },
  ): Promise<boolean> {
    let answer: T | undefined;
    try {
      await store.update((current) => {
        const result = run(current);
        answer = result.answer;
        return result.categories;
      });
    } catch (err) {
      if (err instanceof AdminImportError) {
        res.status(err.status).json({
          ok: false,
          error: err.message,
          ...err.details,
        } satisfies AdminImportErrorBody);
        return false;
      }
      if (err instanceof AdminEditError) {
        res
          .status(err.status)
          .json({ ok: false, error: err.message, field: err.field } satisfies AdminErrorBody);
        return false;
      }
      // Never the error itself: a store refusal may quote a word (DECISIONS 103).
      console.error(`Admin: could not save ${store.path}`);
      sendError(res, 500, ADMIN_ERRORS.editSaveFailed);
      return false;
    }
    // Built by this file's own helpers from the saved category: never an error object, so nothing
    // here can carry a store message to the generic error logger.
    res.json(answer);
    return true;
  }

  router.get('/categories', requireAdmin, (_req, res) => {
    const list = [...store.read()]
      .sort((a, b) => a.title.localeCompare(b.title, 'en') || (a.id < b.id ? -1 : 1))
      .map((c) => ({
        id: c.id,
        title: c.title,
        emoji: c.emoji,
        defaultOn: c.defaultOn,
        hidden: c.hidden,
        wordCount: c.words.length,
      }));
    res.json({ categories: list } satisfies AdminCategoriesResponse);
  });

  router.get('/categories/:id', requireAdmin, (req, res) => {
    const id = idParam(res, req.params.id, NO_CATEGORY);
    if (id === undefined) return;
    const category = store.read().find((c) => c.id === id);
    if (!category) return sendError(res, 404, NO_CATEGORY);
    res.json({ category: toAdminCategory(category) } satisfies AdminCategoryResponse);
  });

  router.post(
    '/categories',
    requireAdmin,
    requireWrite,
    json(4 * 1024),
    async (req: Request, res: Response) => {
      const body = adminCategoryCreateBodySchema.safeParse(req.body);
      if (!body.success) return sendIssue(res, body.error.issues);
      await edit(res, (current) => {
        const { categories, category } = createCategory(current, body.data);
        return { categories, answer: { category: toAdminCategory(category) } };
      });
    },
    bodyErrors,
  );

  router.patch(
    '/categories/:id',
    requireAdmin,
    requireWrite,
    json(4 * 1024),
    async (req: Request, res: Response) => {
      const id = idParam(res, req.params.id, NO_CATEGORY);
      if (id === undefined) return;
      const body = adminCategoryPatchBodySchema.safeParse(req.body);
      if (!body.success) return sendIssue(res, body.error.issues);
      await edit(res, (current) => {
        const { categories, category } = patchCategory(current, id, body.data);
        return { categories, answer: { category: toAdminCategory(category) } };
      });
    },
    bodyErrors,
  );

  // No body is read, but a write still needs this site's Origin and the JSON content type.
  router.delete('/categories/:id', requireAdmin, requireWrite, async (req, res) => {
    const id = idParam(res, req.params.id, NO_CATEGORY);
    if (id === undefined) return;
    await edit(res, (current) => ({
      categories: deleteCategory(current, id),
      answer: { ok: true } satisfies AdminOkResponse,
    }));
  });

  router.post(
    '/categories/:id/words',
    requireAdmin,
    requireWrite,
    json(4 * 1024),
    async (req: Request, res: Response) => {
      const id = idParam(res, req.params.id, NO_CATEGORY);
      if (id === undefined) return;
      const body = adminWordBodySchema.safeParse(req.body);
      if (!body.success) return sendIssue(res, body.error.issues);
      await edit(res, (current) => {
        const { categories, category } = addWord(current, id, body.data);
        return { categories, answer: { category: toAdminCategory(category) } };
      });
    },
    bodyErrors,
  );

  router.post(
    '/categories/:id/words/bulk',
    requireAdmin,
    requireWrite,
    // The text's own limit is in characters; JSON escapes need room around it.
    json(2 * ADMIN_BULK_BYTES_MAX),
    async (req: Request, res: Response) => {
      const id = idParam(res, req.params.id, NO_CATEGORY);
      if (id === undefined) return;
      const body = adminBulkBodySchema.safeParse(req.body);
      if (!body.success) return sendIssue(res, body.error.issues);
      await edit(res, (current) => {
        const { categories, category, added, duplicates, errors } = addBulk(
          current,
          id,
          body.data.text,
        );
        return {
          categories,
          answer: {
            category: toAdminCategory(category),
            added,
            duplicates,
            errors,
          } satisfies AdminBulkResponse,
        };
      });
    },
    bodyErrors,
  );

  router.patch(
    '/categories/:id/words/:wordId',
    requireAdmin,
    requireWrite,
    json(4 * 1024),
    async (req: Request, res: Response) => {
      const id = idParam(res, req.params.id, NO_CATEGORY);
      if (id === undefined) return;
      const wordId = idParam(res, req.params.wordId, NO_WORD);
      if (wordId === undefined) return;
      const body = adminWordPatchBodySchema.safeParse(req.body);
      if (!body.success) return sendIssue(res, body.error.issues);
      await edit(res, (current) => {
        const { categories, category } = patchWord(current, id, wordId, body.data);
        return { categories, answer: { category: toAdminCategory(category) } };
      });
    },
    bodyErrors,
  );

  router.delete(
    '/categories/:id/words/:wordId',
    requireAdmin,
    requireWrite,
    async (req: Request, res: Response) => {
      const id = idParam(res, req.params.id, NO_CATEGORY);
      if (id === undefined) return;
      const wordId = idParam(res, req.params.wordId, NO_WORD);
      if (wordId === undefined) return;
      await edit(res, (current) => {
        const { categories, category } = deleteWord(current, id, wordId);
        return { categories, answer: { category: toAdminCategory(category) } };
      });
    },
  );
  // ---------- Export and import (F82) ----------
  // Under their own paths, not `/categories/…`, so `export` and `import` stay usable category ids.

  /** A download: pretty JSON, as the seed packs are written, saved under `name`. */
  const download = (res: Response, name: string, body: unknown) => {
    res.attachment(name);
    res.type('json');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(`${JSON.stringify(body, null, 2)}\n`);
  };

  // Every category, in the store's order, as an array of packs.
  // SPEC-QUESTION: the spec says "or all of them" without a format; one array, which import
  // refuses with a message (DECISIONS 108).
  router.get('/export', requireAdmin, (_req, res) => {
    download(res, EXPORT_ALL_FILE, store.read().map(categoryToPack));
  });

  router.get('/export/:id', requireAdmin, (req, res) => {
    const id = idParam(res, req.params.id, NO_CATEGORY);
    if (id === undefined) return;
    const category = store.read().find((c) => c.id === id);
    if (!category) return sendError(res, 404, NO_CATEGORY);
    download(res, exportFileName(id), categoryToPack(category));
  });

  /** The import's body is the file itself: its own size and parse errors. */
  const importBodyErrors: ErrorRequestHandler = (err: { type?: string }, _req, res, next) => {
    if (err.type === 'entity.too.large') return sendError(res, 413, ADMIN_ERRORS.importTooLarge);
    if (err.type === 'entity.parse.failed') return sendError(res, 400, ADMIN_ERRORS.importNotJson);
    next(err);
  };

  // The body is the pack file as chosen (capped at 256 KB); `?onClash=rename|replace` answers the
  // 409 a taken id gets. Checked with the pack schema, then by the store, before anything is saved.
  router.post(
    '/import',
    requireAdmin,
    requireWrite,
    json(ADMIN_IMPORT_BYTES_MAX),
    async (req: Request, res: Response) => {
      const query = adminImportQuerySchema.safeParse(req.query);
      if (!query.success) return sendIssue(res, query.error.issues);
      await edit(res, (current) => {
        const { categories, category, replaced } = importCategory(
          current,
          req.body,
          query.data.onClash,
        );
        return {
          categories,
          answer: { category: toAdminCategory(category), replaced } satisfies AdminImportResponse,
        };
      });
    },
    importBodyErrors,
  );

  // ---------- Word generation (F83) ----------
  // Jobs and drafts live in memory (generate/jobs.ts). A draft is reviewed on the admin page and
  // saved through the same edits and store checks as any other words.

  /** A job id from the path, or a 404 sent. */
  const jobParam = (res: Response, value: unknown) => {
    if (typeof value === 'string' && /^[\w-]{1,40}$/.test(value)) return value;
    sendError(res, 404, NO_DRAFT);
    return undefined;
  };

  router.get('/generate', requireAdmin, (_req, res) => {
    res.json({
      mode: generation.mode,
      off: generation.mode === 'off' ? GENERATION_OFF : null,
      jobs: generation.list(),
    } satisfies AdminGenerateStatus);
  });

  router.post(
    '/generate',
    requireAdmin,
    requireWrite,
    json(4 * 1024),
    (req: Request, res: Response) => {
      const body = adminGenerateSchemaFor(req.body).safeParse(req.body);
      if (!body.success) return sendIssue(res, body.error.issues);
      const count = body.data.count ?? GENERATE_COUNT_DEFAULT;
      let started;
      if ('categoryId' in body.data) {
        const id = body.data.categoryId;
        const category = store.read().find((c) => c.id === id);
        if (!category) return sendError(res, 404, NO_CATEGORY);
        started = generation.start({ kind: 'more', category, count });
      } else {
        started = generation.start({ kind: 'new', title: body.data.title.trim(), count });
      }
      if (!started.ok) return sendError(res, started.status, started.error);
      res.status(202).json({ job: started.job } satisfies AdminGenerationResponse);
    },
    bodyErrors,
  );

  router.get('/generate/:id', requireAdmin, (req, res) => {
    const id = jobParam(res, req.params.id);
    if (id === undefined) return;
    const job = generation.get(id);
    if (!job) return sendError(res, 404, NO_DRAFT);
    res.json({ job } satisfies AdminGenerationResponse);
  });

  // The reviewed words: only the ticked ones, as edited. A new category is saved hidden; "more"
  // adds to its category. The draft is gone once saved, and kept when the save is refused.
  router.post(
    '/generate/:id/save',
    requireAdmin,
    requireWrite,
    json(64 * 1024),
    async (req: Request, res: Response) => {
      const id = jobParam(res, req.params.id);
      if (id === undefined) return;
      const body = adminDraftSaveBodySchema.safeParse(req.body);
      if (!body.success) return sendIssue(res, body.error.issues);
      const taken = generation.take(id);
      if (!taken.ok) return sendError(res, taken.status, taken.error);
      const { job } = taken;
      let saved = false;
      try {
        saved = await edit(res, (current) => {
          const result =
            job.kind === 'new'
              ? createDraftCategory(current, {
                  title: body.data.title ?? job.title,
                  emoji: body.data.emoji ?? job.draft?.emoji ?? '',
                  words: body.data.words,
                })
              : addDraftWords(current, job.categoryId ?? '', body.data.words);
          return {
            categories: result.categories,
            answer: {
              category: toAdminCategory(result.category),
              added: result.added,
              duplicates: result.duplicates,
            } satisfies AdminDraftSaveResponse,
          };
        });
      } finally {
        if (saved) generation.finish(id);
        else generation.release(id);
      }
    },
    bodyErrors,
  );

  router.delete('/generate/:id', requireAdmin, requireWrite, (req, res) => {
    const id = jobParam(res, req.params.id);
    if (id === undefined) return;
    const result = generation.discard(id);
    if (!result.ok) return sendError(res, result.status, result.error);
    res.json({ ok: true } satisfies AdminOkResponse);
  });
}

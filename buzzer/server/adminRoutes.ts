import express, {
  type ErrorRequestHandler,
  type Request,
  type RequestHandler,
  type Response,
  type Router,
} from 'express';
import {
  ADMIN_COOKIE,
  ADMIN_IMPORT_MAX_BYTES,
  ADMIN_RATE_LIMITED_ERROR,
  ADMIN_WRONG_PASSWORD_ERROR,
} from '../shared/constants.js';
import {
  adminLoginBodySchema,
  draftSetSchema,
  idSchema,
  questionSetSchema,
  sampleHiddenBodySchema,
} from '../shared/schemas.js';
import { describePath } from '../shared/setFile.js';
import type {
  AdminDraftIdsResponse,
  AdminDraftResponse,
  AdminImportResponse,
  AdminPublishErrorBody,
  AdminSessionResponse,
  BuiltInSetsResponse,
  HttpErrorBody,
  QuestionSet,
} from '../shared/types.js';
import { adminCookie, verifyAdminPassword, type AdminSessions } from './admin.js';
import { capped, fileEntries, importBuiltIns } from './builtInImport.js';
import type { BuiltInStore } from './builtInStore.js';
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

/** "buzzr-built-ins-2026-10-30.json", by the server's UTC date. */
export function builtInsExportFileName(now: number): string {
  return `buzzr-built-ins-${new Date(now).toISOString().slice(0, 10)}.json`;
}

const SAVE_FAILED_ERROR = 'Could not save the built-in sets. Try again.';
const SAMPLE_HIDDEN_ERROR = 'Send {"hidden": true} or {"hidden": false}.';
const NO_SET_ERROR = 'There is no built-in set with that id.';
const DRAFT_BODY_ERROR = 'Send the draft as a set.';

/**
 * `/api/admin/*`, mounted only when `ADMIN_PASSWORD_HASH` is set (F105). Later admin routes go behind
 * `requireAdmin`, and writes behind `requireWrite` as well. The built-in set routes (F106) need
 * `builtIns`; without it they are 404 like any unknown path.
 */
export function adminRoutes(
  password: AdminPasswordHash,
  sessions: AdminSessions,
  loginLimiter: RateLimiter,
  clock: () => number,
  builtIns?: BuiltInStore,
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

  if (builtIns) builtInRoutes(router, builtIns, requireAdmin, clock);

  router.use((_req, res) => sendError(res, 404, 'Not found.'));

  return router;
}

/** Import, delete, export and hide the sample (F106). Every change is live on the next fetch. */
function builtInRoutes(
  router: Router,
  builtIns: BuiltInStore,
  requireAdmin: RequestHandler,
  clock: () => number,
): void {
  /** A body too large or not JSON answers with a readable error, not Express's HTML page. */
  const onBodyError =
    (tooLarge: string, notJson: string): ErrorRequestHandler =>
    (err: { type?: string }, _req, res, next) => {
      if (err.type === 'entity.too.large') return sendError(res, 413, tooLarge);
      if (err.type === 'entity.parse.failed') return sendError(res, 400, notJson);
      next(err);
    };

  router.post(
    '/built-in-sets/import',
    requireAdmin,
    requireWrite,
    express.json({ limit: ADMIN_IMPORT_MAX_BYTES }),
    async (req: Request, res: Response) => {
      const read = fileEntries(req.body);
      if (!read.ok) return sendError(res, 400, read.error);
      let result: AdminImportResponse | undefined;
      try {
        await builtIns.update((data) => {
          const imported = importBuiltIns(data, read.entries);
          result = imported.result;
          return imported.data;
        });
      } catch {
        return sendError(res, 500, SAVE_FAILED_ERROR);
      }
      res.json(result! satisfies AdminImportResponse);
    },
    onBodyError(
      `The file is larger than ${ADMIN_IMPORT_MAX_BYTES / 1024 / 1024} MB.`,
      "This file isn't valid JSON.",
    ),
  );

  // A body is not read, but a write still needs the JSON content type and this site's Origin.
  router.delete('/built-in-sets/:id', requireAdmin, requireWrite, async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    const { sets, drafts } = builtIns.read();
    const known =
      id.success && (sets.some((s) => s.id === id.data) || Object.hasOwn(drafts, id.data));
    if (!id.success || !known) return sendError(res, 404, NO_SET_ERROR);
    try {
      await builtIns.update((data) => ({
        ...data,
        sets: data.sets.filter((s) => s.id !== id.data),
        drafts: Object.fromEntries(Object.entries(data.drafts).filter(([key]) => key !== id.data)),
      }));
    } catch {
      return sendError(res, 500, SAVE_FAILED_ERROR);
    }
    res.json({ ok: true });
  });

  router.put(
    '/sample-hidden',
    requireAdmin,
    requireWrite,
    express.json({ limit: 1024 }),
    async (req: Request, res: Response) => {
      const parsed = sampleHiddenBodySchema.safeParse(req.body);
      if (!parsed.success) return sendError(res, 400, SAMPLE_HIDDEN_ERROR);
      try {
        await builtIns.update((data) => ({ ...data, sampleHidden: parsed.data.hidden }));
      } catch {
        return sendError(res, 500, SAVE_FAILED_ERROR);
      }
      res.json({ sampleHidden: parsed.data.hidden });
    },
    onBodyError(SAMPLE_HIDDEN_ERROR, SAMPLE_HIDDEN_ERROR),
  );

  draftRoutes(router, builtIns, requireAdmin, clock, onBodyError);

  // The live sets only, as an **Export all** file, so it comes back through the import as is.
  router.get('/built-in-sets/export', requireAdmin, (_req, res) => {
    const { sets } = builtIns.read();
    res.attachment(builtInsExportFileName(clock()));
    res.type('application/json');
    res.send(`${JSON.stringify({ sets } satisfies Pick<BuiltInSetsResponse, 'sets'>, null, 2)}\n`);
  });
}

/**
 * The admin's draft of a built-in set (F107): the set editor autosaves into it, **Publish** makes it
 * the live set, **Discard draft** drops it. Only a live set can have a draft, so every route is 404
 * for an id that is not live; deleting the set drops its draft too (F106).
 */
function draftRoutes(
  router: Router,
  builtIns: BuiltInStore,
  requireAdmin: RequestHandler,
  clock: () => number,
  onBodyError: (tooLarge: string, notJson: string) => ErrorRequestHandler,
): void {
  /** The live set with `:id`, or undefined after a 404 has been sent. */
  const liveSet = (req: Request, res: Response): QuestionSet | undefined => {
    const id = idSchema.safeParse(req.params.id);
    const set = id.success ? builtIns.read().sets.find((s) => s.id === id.data) : undefined;
    if (!set) sendError(res, 404, NO_SET_ERROR);
    return set;
  };

  // For the Built-in tab's "Draft" badges.
  router.get('/built-in-sets/drafts', requireAdmin, (_req, res) => {
    res.json({ ids: Object.keys(builtIns.read().drafts) } satisfies AdminDraftIdsResponse);
  });

  router.get('/built-in-sets/:id/draft', requireAdmin, (req, res) => {
    const live = liveSet(req, res);
    if (!live) return;
    const draft = builtIns.read().drafts[live.id];
    res.json({ set: draft ?? live, draft: draft !== undefined } satisfies AdminDraftResponse);
  });

  router.put(
    '/built-in-sets/:id/draft',
    requireAdmin,
    requireWrite,
    // The largest draft the schema allows is well under the import's limit.
    express.json({ limit: ADMIN_IMPORT_MAX_BYTES }),
    async (req: Request, res: Response) => {
      const live = liveSet(req, res);
      if (!live) return;
      const parsed = draftSetSchema.safeParse(req.body);
      if (!parsed.success) {
        const problem = parsed.error.issues[0]!;
        return sendError(res, 400, `${describePath(problem.path)}: ${problem.message}`);
      }
      if (parsed.data.id !== live.id)
        return sendError(res, 400, "The draft's id is not this set's.");
      const draft: QuestionSet = { ...parsed.data, updatedAt: clock() };
      // Checked again in turn: a delete queued ahead of this write must not leave an orphan draft.
      let gone = false;
      try {
        await builtIns.update((data) => {
          gone = !data.sets.some((s) => s.id === live.id);
          return gone ? data : { ...data, drafts: { ...data.drafts, [live.id]: draft } };
        });
      } catch {
        return sendError(res, 500, SAVE_FAILED_ERROR);
      }
      if (gone) return sendError(res, 404, NO_SET_ERROR);
      res.json({ set: draft, draft: true } satisfies AdminDraftResponse);
    },
    onBodyError(
      `The draft is larger than ${ADMIN_IMPORT_MAX_BYTES / 1024 / 1024} MB.`,
      DRAFT_BODY_ERROR,
    ),
  );

  // Answers with the live set, which the editor shows in place of the draft.
  router.delete('/built-in-sets/:id/draft', requireAdmin, requireWrite, async (req, res) => {
    const live = liveSet(req, res);
    if (!live) return;
    try {
      await builtIns.update((data) => ({ ...data, drafts: withoutDraft(data.drafts, live.id) }));
    } catch {
      return sendError(res, 500, SAVE_FAILED_ERROR);
    }
    res.json({ set: live, draft: false } satisfies AdminDraftResponse);
  });

  // A body is not read, but a write still needs the JSON content type and this site's Origin.
  router.post('/built-in-sets/:id/publish', requireAdmin, requireWrite, async (req, res) => {
    const live = liveSet(req, res);
    if (!live) return;
    const draft = builtIns.read().drafts[live.id];
    if (!draft) return sendError(res, 409, 'There is no draft to publish.');
    // The same check as an import, so a published set hosts like any other.
    const parsed = questionSetSchema.safeParse(draft);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'The draft cannot be published yet.',
        problems: capped(parsed.error.issues.map((i) => `${describePath(i.path)}: ${i.message}`)),
      } satisfies AdminPublishErrorBody);
      return;
    }
    const published: QuestionSet = { ...parsed.data, updatedAt: clock() };
    // In turn, the draft checked must still be the one stored: a save or delete queued ahead of
    // this write wins, and the admin publishes again.
    let changed = false;
    try {
      await builtIns.update((data) => {
        changed = data.drafts[live.id] !== draft || !data.sets.some((s) => s.id === live.id);
        if (changed) return data;
        return {
          ...data,
          // In place, so the set keeps its spot in the list.
          sets: data.sets.map((s) => (s.id === live.id ? published : s)),
          drafts: withoutDraft(data.drafts, live.id),
        };
      });
    } catch {
      return sendError(res, 500, SAVE_FAILED_ERROR);
    }
    if (changed) return sendError(res, 409, 'The draft changed while publishing. Publish again.');
    res.json({ set: published, draft: false } satisfies AdminDraftResponse);
  });
}

function withoutDraft(
  drafts: Record<string, QuestionSet>,
  id: string,
): Record<string, QuestionSet> {
  return Object.fromEntries(Object.entries(drafts).filter(([key]) => key !== id));
}

// The admin's category and generation routes (F110, F113), mounted inside `/api/admin` behind the
// session check. Writes also need `requireWrite` (same origin, JSON). Generation itself runs in
// the job runner; these routes start, list and cancel jobs, and publish or delete a category.

import express, {
  type ErrorRequestHandler,
  type Request,
  type RequestHandler,
  type Response,
  type Router,
} from 'express';
import { BUILT_IN_SETS_MAX, HISTORY_LIMIT_MAX } from '../../shared/constants.js';
import {
  categoryHiddenBodySchema,
  categoryNameSchema,
  generateBodySchema,
  idSchema,
  questionSetSchema,
  historyQuerySchema,
  replaceBodySchema,
} from '../../shared/schemas.js';
import { describePath } from '../../shared/setFile.js';
import type {
  AdminCategoriesResponse,
  AdminCategoryHiddenResponse,
  AdminDeleteCategoryResponse,
  AdminHistoryResponse,
  AdminJobsResponse,
  AdminPublishAllErrorBody,
  AdminPublishAllResponse,
  AdminPublishUnreviewedBody,
  GenerateStartResponse,
  HttpErrorBody,
  QuestionSet,
} from '../../shared/types.js';
import { capped } from '../builtInImport.js';
import type { BuiltInStore } from '../builtInStore.js';
import { categoryKey, categoryName, listCategories, setsInCategory } from './categories.js';
import type { GenerationHistory } from './history.js';
import { GENERATION_OFF_ERROR, type JobRunner, type StartResult } from './jobs.js';

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ ok: false, error } satisfies HttpErrorBody);
}

const GENERATE_BODY_ERROR =
  'Send a category name (1–40 characters), guidance of at most 500, and 1–3 different levels of 5–30 questions.';
const NO_CATEGORY_ERROR = 'There is no category with that name.';
const SAVE_FAILED_ERROR = 'Could not save the built-in sets. Try again.';
const CATEGORY_BUSY_ERROR =
  'This category is being generated or has questions being replaced. Wait for it to finish.';
const REPLACE_BODY_ERROR = 'Send an optional note of at most 200 characters.';
const NO_JOB_ERROR = 'There is no job with that id.';
const HIDDEN_BODY_ERROR = 'Send {"hidden": true} or {"hidden": false}.';

/** Why a publish of the whole category stopped, if it did. */
type PublishStop =
  | { kind: 'none' }
  | { kind: 'invalid'; set: QuestionSet; problems: string[] }
  | { kind: 'full' }
  | { kind: 'nothing' }
  | { kind: 'unreviewed'; sets: QuestionSet[] };

export function generateRoutes(
  router: Router,
  builtIns: BuiltInStore,
  jobs: JobRunner,
  requireAdmin: RequestHandler,
  requireWrite: RequestHandler,
  clock: () => number,
  history: GenerationHistory,
): void {
  /**
   * The category key from `:name`, or undefined after a 404 was sent. `orFailed` also takes a
   * category that has no set, only a failed job (a new category whose first level failed).
   */
  const categoryOf = (req: Request, res: Response, orFailed = false): string | undefined => {
    const name = categoryNameSchema.safeParse(req.params.name);
    if (name.success) {
      const key = categoryKey(name.data);
      if (setsInCategory(builtIns.read(), key).length > 0) return key;
      const state = jobs.latestByCategory().get(key)?.state;
      if (orFailed && (state === 'failed' || state === 'cancelled')) return key;
    }
    sendError(res, 404, NO_CATEGORY_ERROR);
    return undefined;
  };

  const answerStart = (res: Response, started: StartResult): void => {
    if (!started.ok) return sendError(res, started.status, started.error);
    res.status(202).json({ jobId: started.job.id } satisfies GenerateStartResponse);
  };

  router.get('/categories', requireAdmin, (_req, res) => {
    const latest = jobs.latestByCategory();
    const wanted = jobs.wantedBySet();
    const categories = listCategories(builtIns.read()).map((c) => ({
      ...c,
      levels: c.levels.map((level) => ({ ...level, wanted: wanted.get(level.setId) ?? null })),
      job: null,
    }));
    const known = new Set(categories.map((c) => categoryKey(c.name)));
    // A first level still being written, or a new category whose job failed, has no set yet.
    // A done job's category with no set left was deleted, so it is not listed (F111).
    for (const job of latest.values()) {
      if (job.state !== 'done' && !known.has(categoryKey(job.category))) {
        categories.push({ name: job.category, levels: [], job: null, hidden: false });
        known.add(categoryKey(job.category));
      }
    }
    for (const category of categories) {
      const job = latest.get(categoryKey(category.name));
      if (job && job.state !== 'done') Object.assign(category, { job });
    }
    categories.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    res.json({
      categories,
      generation: {
        enabled: jobs.enabled,
        usedToday: jobs.usedToday(),
        dailyLimit: jobs.dailyLimit,
        running: jobs.running(),
        replacements: { usedToday: jobs.replacesToday(), dailyLimit: jobs.replaceDailyLimit },
      },
    } satisfies AdminCategoriesResponse);
  });

  const onBodyError: ErrorRequestHandler = (err: { type?: string }, _req, res, next) => {
    if (err.type === 'entity.too.large' || err.type === 'entity.parse.failed') {
      return sendError(res, 400, GENERATE_BODY_ERROR);
    }
    next(err);
  };

  const onHiddenBodyError: ErrorRequestHandler = (err: { type?: string }, _req, res, next) => {
    if (err.type === 'entity.too.large' || err.type === 'entity.parse.failed') {
      return sendError(res, 400, HIDDEN_BODY_ERROR);
    }
    next(err);
  };

  router.post(
    '/categories/generate',
    requireAdmin,
    requireWrite,
    // A 40-character name and 500 characters of guidance are at most about 2 KB of UTF-8.
    express.json({ limit: 8192 }),
    (req: Request, res: Response) => {
      // With no key nothing else matters, not even a bad body.
      if (!jobs.enabled) return sendError(res, 503, GENERATION_OFF_ERROR);
      const parsed = generateBodySchema.safeParse(req.body);
      if (!parsed.success) return sendError(res, 400, GENERATE_BODY_ERROR);
      const { category, guidance = '', levels } = parsed.data;
      answerStart(res, jobs.start({ kind: 'generate', category, guidance, levels }));
    },
    onBodyError,
  );

  // A body is not read, but a write still needs the JSON content type and this site's Origin.
  router.post('/built-in-sets/:id/regenerate', requireAdmin, requireWrite, (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return sendError(res, 404, 'There is no built-in set with that id.');
    answerStart(res, jobs.start({ kind: 'regenerate', setId: id.data }));
  });

  // One question of a draft written again (`:qid`), or one more added: a replace job (F113).
  const replaceRoute =
    (questionIdOf: (req: Request) => string | null | undefined): RequestHandler =>
    (req, res) => {
      if (!jobs.enabled) return sendError(res, 503, GENERATION_OFF_ERROR);
      const id = idSchema.safeParse(req.params.id);
      if (!id.success) return sendError(res, 404, 'There is no draft with that id.');
      const questionId = questionIdOf(req);
      if (questionId === undefined) {
        return sendError(res, 404, 'The draft has no question with that id.');
      }
      // No body at all is no note.
      const parsed = replaceBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) return sendError(res, 400, REPLACE_BODY_ERROR);
      answerStart(
        res,
        jobs.start({ kind: 'replace', setId: id.data, questionId, note: parsed.data.note ?? '' }),
      );
    };
  const onReplaceBodyError: ErrorRequestHandler = (err: { type?: string }, _req, res, next) => {
    if (err.type === 'entity.too.large' || err.type === 'entity.parse.failed') {
      return sendError(res, 400, REPLACE_BODY_ERROR);
    }
    next(err);
  };
  // A 200-character note is at most about 800 bytes of UTF-8.
  const replaceBody = express.json({ limit: 4096 });

  router.post(
    '/built-in-sets/:id/questions/add',
    requireAdmin,
    requireWrite,
    replaceBody,
    replaceRoute(() => null),
    onReplaceBodyError,
  );
  router.post(
    '/built-in-sets/:id/questions/:qid/replace',
    requireAdmin,
    requireWrite,
    replaceBody,
    replaceRoute((req) => {
      const qid = idSchema.safeParse(req.params.qid);
      return qid.success ? qid.data : undefined;
    }),
    onReplaceBodyError,
  );

  router.get('/jobs', requireAdmin, (req, res) => {
    const setId = idSchema.safeParse(req.query.setId);
    if (!setId.success) return sendError(res, 400, 'Send the set id as ?setId=.');
    res.json({ jobs: jobs.replacesFor(setId.data) } satisfies AdminJobsResponse);
  });

  router.get('/jobs/:id', requireAdmin, (req, res) => {
    const job = jobs.get(req.params.id as string);
    if (!job) return sendError(res, 404, NO_JOB_ERROR);
    res.json(job);
  });

  // A queued job stops at once; a running one after its current API call (F113).
  router.post('/jobs/:id/cancel', requireAdmin, requireWrite, (req, res) => {
    const cancelled = jobs.cancel(req.params.id as string);
    if (!cancelled.ok) return sendError(res, cancelled.status, cancelled.error);
    res.json(cancelled.job);
  });

  // Every ended job, newest first, with the spend today, over 30 days and in all (F127).
  router.get('/history', requireAdmin, async (req, res) => {
    const query = historyQuerySchema.safeParse(req.query);
    if (!query.success) {
      return sendError(res, 400, `Send ?limit= as a whole number from 1 to ${HISTORY_LIMIT_MAX}.`);
    }
    let answer: AdminHistoryResponse;
    try {
      answer = await history.read(query.data.limit, clock());
    } catch {
      return sendError(res, 500, 'Could not read the generation history. Try again.');
    }
    res.json(answer satisfies AdminHistoryResponse);
  });

  // Every draft in the category goes live, in list order. While any draft waits for review nothing
  // is published (400, naming them). Otherwise the first that cannot be published stops it: those
  // before it stay published, and the answer names it.
  router.post('/categories/:name/publish', requireAdmin, requireWrite, async (req, res) => {
    const key = categoryOf(req, res);
    if (key === undefined) return;
    if (jobs.busyWith(key)) return sendError(res, 409, CATEGORY_BUSY_ERROR);
    let published = 0;
    // Set inside the update, so cast: TS would narrow a plain initialiser to 'none' for good.
    let stop = { kind: 'none' } as PublishStop;
    const now = clock();
    try {
      await builtIns.update((data) => {
        const drafts = setsInCategory(data, key).filter(({ draft }) => draft !== undefined);
        if (drafts.length === 0) {
          stop = { kind: 'nothing' };
          return data;
        }
        // Every level Claude wrote needs the admin's review first, and then all go live (F114).
        const waiting = drafts.filter(({ draft }) => data.unreviewed.includes(draft!.id));
        if (waiting.length > 0) {
          stop = { kind: 'unreviewed', sets: waiting.map(({ draft }) => draft!) };
          return data;
        }
        let sets = data.sets;
        const left = { ...data.drafts };
        for (const { draft } of drafts) {
          const parsed = questionSetSchema.safeParse(draft);
          if (!parsed.success) {
            stop = {
              kind: 'invalid',
              set: draft!,
              problems: capped(
                parsed.error.issues.map((i) => `${describePath(i.path)}: ${i.message}`),
              ),
            };
            break;
          }
          const set: QuestionSet = { ...parsed.data, updatedAt: now };
          const replaces = sets.some((s) => s.id === set.id);
          if (!replaces && sets.length >= BUILT_IN_SETS_MAX) {
            stop = { kind: 'full' };
            break;
          }
          sets = replaces ? sets.map((s) => (s.id === set.id ? set : s)) : [...sets, set];
          delete left[set.id];
          published++;
        }
        return { ...data, sets, drafts: left };
      });
    } catch {
      return sendError(res, 500, SAVE_FAILED_ERROR);
    }
    const outcome = stop;
    if (outcome.kind === 'nothing') {
      return sendError(res, 409, 'This category has no drafts to publish.');
    }
    if (outcome.kind === 'unreviewed') {
      const titles = outcome.sets.map((set) => `“${set.title.trim() || 'Untitled set'}”`);
      res.status(400).json({
        ok: false,
        error: `Mark every level reviewed before publishing. Not reviewed yet: ${titles.join(', ')}.`,
        unreviewed: outcome.sets.map((set) => set.id),
      } satisfies AdminPublishUnreviewedBody);
      return;
    }
    if (outcome.kind === 'full') {
      res.status(409).json({
        ok: false,
        error: `The built-ins are full (${BUILT_IN_SETS_MAX} sets). Delete some first.`,
        published,
      });
      return;
    }
    if (outcome.kind === 'invalid') {
      const title = outcome.set.title.trim() || 'Untitled set';
      res.status(400).json({
        ok: false,
        error: `“${title}” cannot be published yet.`,
        problems: outcome.problems,
        published,
        setId: outcome.set.id,
      } satisfies AdminPublishAllErrorBody);
      return;
    }
    res.json({ published } satisfies AdminPublishAllResponse);
  });

  // Removes every set of the category, live and draft alike, and forgets its failed job.
  // Hides a category's live sets from hosts, or shows them again (F126). Drafts, review and
  // publishing go on as before, and a room already hosting one of its sets plays on. A job running
  // on the category does not stop it: a hidden category's sets are just not listed.
  router.put(
    '/categories/:name/hidden',
    requireAdmin,
    requireWrite,
    express.json({ limit: 1024 }),
    async (req: Request, res: Response) => {
      const key = categoryOf(req, res);
      if (key === undefined) return;
      const parsed = categoryHiddenBodySchema.safeParse(req.body);
      if (!parsed.success) return sendError(res, 400, HIDDEN_BODY_ERROR);
      const { hidden } = parsed.data;
      let name = key;
      try {
        await builtIns.update((data) => {
          name = categoryName(data, key) ?? key;
          const others = data.hiddenCategories.filter((k) => k !== key);
          return { ...data, hiddenCategories: hidden ? [...others, key] : others };
        });
      } catch {
        return sendError(res, 500, SAVE_FAILED_ERROR);
      }
      res.json({ name, hidden } satisfies AdminCategoryHiddenResponse);
    },
    onHiddenBodyError,
  );

  router.delete('/categories/:name', requireAdmin, requireWrite, async (req, res) => {
    const key = categoryOf(req, res, true);
    if (key === undefined) return;
    if (jobs.busyWith(key)) return sendError(res, 409, CATEGORY_BUSY_ERROR);
    let deleted = 0;
    try {
      await builtIns.update((data) => {
        const ids = new Set(setsInCategory(data, key).map(({ set }) => set.id));
        deleted = ids.size;
        return {
          ...data,
          sets: data.sets.filter((s) => !ids.has(s.id)),
          drafts: Object.fromEntries(Object.entries(data.drafts).filter(([id]) => !ids.has(id))),
          // A later category of the same name starts shown (F126).
          hiddenCategories: data.hiddenCategories.filter((k) => k !== key),
        };
      });
    } catch {
      return sendError(res, 500, SAVE_FAILED_ERROR);
    }
    // Its failed job would otherwise keep the category listed with no levels.
    jobs.forget(key);
    res.json({ deleted } satisfies AdminDeleteCategoryResponse);
  });
}

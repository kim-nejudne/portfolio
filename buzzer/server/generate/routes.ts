// The admin's category and generation routes (F110), mounted inside `/api/admin` behind the
// session check. Writes also need `requireWrite` (same origin, JSON). Generation itself runs in
// the job runner; these routes start jobs, report them, and publish or delete a whole category.

import express, {
  type ErrorRequestHandler,
  type Request,
  type RequestHandler,
  type Response,
  type Router,
} from 'express';
import { BUILT_IN_SETS_MAX } from '../../shared/constants.js';
import {
  categoryNameSchema,
  generateBodySchema,
  idSchema,
  questionSetSchema,
} from '../../shared/schemas.js';
import { describePath } from '../../shared/setFile.js';
import type {
  AdminCategoriesResponse,
  AdminDeleteCategoryResponse,
  AdminPublishAllErrorBody,
  AdminPublishAllResponse,
  GenerateStartResponse,
  HttpErrorBody,
  QuestionSet,
} from '../../shared/types.js';
import { capped } from '../builtInImport.js';
import type { BuiltInStore } from '../builtInStore.js';
import { categoryKey, listCategories, setsInCategory } from './categories.js';
import { GENERATION_OFF_ERROR, type JobRunner, type StartResult } from './jobs.js';

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ ok: false, error } satisfies HttpErrorBody);
}

const GENERATE_BODY_ERROR =
  'Send a category name (1–40 characters), guidance of at most 500, and 1–3 different levels of 5–30 questions.';
const NO_CATEGORY_ERROR = 'There is no category with that name.';
const SAVE_FAILED_ERROR = 'Could not save the built-in sets. Try again.';
const CATEGORY_BUSY_ERROR = 'This category is being generated. Wait for it to finish.';

/** Why a publish of the whole category stopped, if it did. */
type PublishStop =
  | { kind: 'none' }
  | { kind: 'invalid'; set: QuestionSet; problems: string[] }
  | { kind: 'full' }
  | { kind: 'nothing' };

export function generateRoutes(
  router: Router,
  builtIns: BuiltInStore,
  jobs: JobRunner,
  requireAdmin: RequestHandler,
  requireWrite: RequestHandler,
  clock: () => number,
): void {
  /** The category key from `:name`, or undefined after a 404 was sent. */
  const categoryOf = (req: Request, res: Response): string | undefined => {
    const name = categoryNameSchema.safeParse(req.params.name);
    if (name.success) {
      const key = categoryKey(name.data);
      if (setsInCategory(builtIns.read(), key).length > 0) return key;
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
    const categories = listCategories(builtIns.read()).map((c) => ({ ...c, job: null }));
    const known = new Set(categories.map((c) => categoryKey(c.name)));
    // A first level still being written, or a new category whose job failed, has no set yet.
    for (const job of latest.values()) {
      if (!known.has(categoryKey(job.category))) {
        categories.push({ name: job.category, levels: [], job: null });
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
      },
    } satisfies AdminCategoriesResponse);
  });

  const onBodyError: ErrorRequestHandler = (err: { type?: string }, _req, res, next) => {
    if (err.type === 'entity.too.large' || err.type === 'entity.parse.failed') {
      return sendError(res, 400, GENERATE_BODY_ERROR);
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

  router.get('/jobs/:id', requireAdmin, (req, res) => {
    const job = jobs.get(req.params.id as string);
    if (!job) return sendError(res, 404, 'There is no job with that id.');
    res.json(job);
  });

  // Every draft in the category goes live, in list order. The first that cannot be published
  // stops it: those before it stay published, and the answer names it.
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

  // Removes every set of the category, live and draft alike.
  router.delete('/categories/:name', requireAdmin, requireWrite, async (req, res) => {
    const key = categoryOf(req, res);
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
        };
      });
    } catch {
      return sendError(res, 500, SAVE_FAILED_ERROR);
    }
    res.json({ deleted } satisfies AdminDeleteCategoryResponse);
  });
}

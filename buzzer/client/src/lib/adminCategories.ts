// The admin dashboard's requests (F111): the category list, starting a generation or a
// regenerate, polling and cancelling a job (F115), and publishing or deleting a whole category.
// Then a level's review list (F117): one question saved or removed, and the level marked reviewed;
// and its replacements and additions (F118): started, and the set's jobs listed for polling.
// Hiding a category from hosts, or showing it again (F126), and its emoji (F130).
// A 401 ends the session, as on the Built-in tab; any other failure throws the server's message.

import type {
  AdminCategoriesResponse,
  AdminCategoryEmojiResponse,
  AdminCategoryHiddenResponse,
  AdminJobsResponse,
  AdminDeleteCategoryResponse,
  AdminDraftResponse,
  AdminPublishAllErrorBody,
  AdminPublishAllResponse,
  DraftQuestionBody,
  GenerateBody,
  GenerateJob,
  GenerateStartResponse,
  QuestionSet,
} from '../../../shared/types.js';
import { adminGet, checked } from './adminBuiltIns.js';
import { adminWrite } from './adminSession.js';
import { refreshBuiltInSets } from './builtInSets.js';

const categoryPath = (name: string) => `/categories/${encodeURIComponent(name)}`;

/** "Rivers", " rivers " and "RIVERS" are one category, as on the server. */
export const categoryKey = (name: string) => name.trim().toLowerCase();

/** `/admin/categories/:name`, the category's review page (F116). */
export const categoryRoute = (name: string) => `/admin/categories/${encodeURIComponent(name)}`;

/** `/admin/categories/:name/:setId`, a level's review list (F117). */
export const levelRoute = (name: string, setId: string) =>
  `${categoryRoute(name)}/${encodeURIComponent(setId)}`;

/** `GET /api/admin/categories`. */
export async function loadCategories(): Promise<AdminCategoriesResponse> {
  const response = await checked(await adminGet('/categories'), 'Could not load the categories');
  return (await response.json()) as AdminCategoriesResponse;
}

/** `POST /api/admin/categories/generate`: the new job's id. 429 and 409 throw their message. */
export async function startGeneration(body: GenerateBody): Promise<string> {
  const response = await checked(
    await adminWrite('POST', '/categories/generate', body),
    'Could not start the generation',
  );
  return ((await response.json()) as GenerateStartResponse).jobId;
}

/** `POST /api/admin/built-in-sets/:id/regenerate`: the new job's id. */
export async function regenerateSet(setId: string): Promise<string> {
  const response = await checked(
    await adminWrite('POST', `/built-in-sets/${encodeURIComponent(setId)}/regenerate`, {}),
    'Could not start the regenerate',
  );
  return ((await response.json()) as GenerateStartResponse).jobId;
}

/** The server does not know the job: a wrong `?job=`, or it restarted and forgot it (F115). */
export class JobGoneError extends Error {}

/** `GET /api/admin/jobs/:id`. A 404 throws `JobGoneError`, which no later poll will fix. */
export async function loadJob(id: string): Promise<GenerateJob> {
  const response = await adminGet(`/jobs/${encodeURIComponent(id)}`);
  if (response.status === 404) {
    throw new JobGoneError(
      'The server does not know this generation. It may have restarted since it began.',
    );
  }
  await checked(response, 'Could not load the generation');
  return (await response.json()) as GenerateJob;
}

/**
 * `POST /api/admin/jobs/:id/cancel` (F113): a running job stops after its current API call, so
 * the job comes back still running until then.
 */
export async function cancelJob(id: string): Promise<GenerateJob> {
  const response = await checked(
    await adminWrite('POST', `/jobs/${encodeURIComponent(id)}/cancel`, {}),
    'Could not cancel',
  );
  return (await response.json()) as GenerateJob;
}

export type PublishAllResult =
  | { ok: true; published: number }
  | { ok: false; error: string; problems: string[]; setId: string; published: number };

/**
 * `POST /api/admin/categories/:name/publish`. A draft that is not playable stops it and comes back
 * named, with its problems, so the page can link to its editor; any other failure throws.
 */
export async function publishCategory(name: string): Promise<PublishAllResult> {
  const response = await adminWrite('POST', `${categoryPath(name)}/publish`, {});
  if (response.status === 400) {
    const body = (await response.json().catch(() => null)) as AdminPublishAllErrorBody | null;
    if (body && Array.isArray(body.problems) && typeof body.setId === 'string') {
      // The drafts before it went live.
      if (body.published > 0) refreshBuiltInSets();
      return {
        ok: false,
        error: body.error,
        problems: body.problems,
        setId: body.setId,
        published: body.published,
      };
    }
    // Refused for another reason (a level left unreviewed, F114): the body is read, so say it here.
    throw new Error(typeof body?.error === 'string' ? body.error : 'Could not publish (400).');
  }
  await checked(response, 'Could not publish');
  refreshBuiltInSets();
  return { ok: true, published: ((await response.json()) as AdminPublishAllResponse).published };
}

const changeListeners = new Set<() => void>();

/**
 * Called after a change the open page makes without moving (F126), so the list pane beside it
 * reads the categories again. Returns the unsubscribe.
 */
export function onCategoriesChanged(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => void changeListeners.delete(listener);
}

/**
 * `PUT /api/admin/categories/:name/hidden` (F126): hides the category's live sets from hosts, or
 * shows them again. Whether it is hidden now.
 */
export async function setCategoryHidden(name: string, hidden: boolean): Promise<boolean> {
  const response = await checked(
    await adminWrite('PUT', `${categoryPath(name)}/hidden`, { hidden }),
    hidden ? 'Could not hide it' : 'Could not show it',
  );
  const body = (await response.json()) as AdminCategoryHiddenResponse;
  refreshBuiltInSets();
  for (const listener of changeListeners) listener();
  return body.hidden;
}

/**
 * `PUT /api/admin/categories/:name/emoji` (F130): the category's emoji, or null to clear it. The
 * emoji as saved.
 */
export async function setCategoryEmoji(name: string, emoji: string | null): Promise<string | null> {
  const response = await checked(
    await adminWrite('PUT', `${categoryPath(name)}/emoji`, { emoji }),
    'Could not save the emoji',
  );
  const body = (await response.json()) as AdminCategoryEmojiResponse;
  refreshBuiltInSets();
  for (const listener of changeListeners) listener();
  return body.emoji;
}

/** `DELETE /api/admin/categories/:name`: every set of the category, live and draft. */
export async function deleteCategory(name: string): Promise<number> {
  const response = await checked(
    await adminWrite('DELETE', categoryPath(name), {}),
    'Could not delete',
  );
  refreshBuiltInSets();
  return ((await response.json()) as AdminDeleteCategoryResponse).deleted;
}

const questionPath = (setId: string, questionId: string) =>
  `/built-in-sets/${encodeURIComponent(setId)}/questions/${encodeURIComponent(questionId)}`;

/**
 * `PUT /api/admin/built-in-sets/:id/questions/:qid` (F114): one question's text, answer and notes,
 * never the whole set, so a change the server made meanwhile survives. The draft as saved.
 */
export async function saveQuestion(
  setId: string,
  questionId: string,
  body: DraftQuestionBody,
): Promise<QuestionSet> {
  const response = await checked(
    await adminWrite('PUT', questionPath(setId, questionId), body),
    'Could not save the question',
  );
  return ((await response.json()) as AdminDraftResponse).set;
}

/** `DELETE /api/admin/built-in-sets/:id/questions/:qid` (F114): the draft without it. */
export async function removeQuestion(setId: string, questionId: string): Promise<QuestionSet> {
  const response = await checked(
    await adminWrite('DELETE', questionPath(setId, questionId), {}),
    'Could not remove the question',
  );
  return ((await response.json()) as AdminDraftResponse).set;
}

/** `POST /api/admin/built-in-sets/:id/reviewed` (F114). Idempotent. */
export async function markReviewed(setId: string): Promise<void> {
  await checked(
    await adminWrite('POST', `/built-in-sets/${encodeURIComponent(setId)}/reviewed`, {}),
    'Could not mark it reviewed',
  );
}

/**
 * `POST /api/admin/built-in-sets/:id/questions/:qid/replace`, or `.../questions/add` without a
 * question (F113): the new job's id. A blank note is sent as none. 429 and 503 throw their message.
 */
export async function startReplace(
  setId: string,
  questionId: string | null,
  note: string,
): Promise<string> {
  const base = `/built-in-sets/${encodeURIComponent(setId)}/questions`;
  const path =
    questionId === null ? `${base}/add` : `${base}/${encodeURIComponent(questionId)}/replace`;
  const trimmed = note.trim();
  const response = await checked(
    await adminWrite('POST', path, trimmed ? { note: trimmed } : {}),
    questionId === null ? 'Could not add a question' : 'Could not replace the question',
  );
  return ((await response.json()) as GenerateStartResponse).jobId;
}

/** `GET /api/admin/jobs?setId=` (F113): the set's replacements, running, queued, then finished. */
export async function loadSetJobs(setId: string): Promise<GenerateJob[]> {
  const response = await checked(
    await adminGet(`/jobs?setId=${encodeURIComponent(setId)}`),
    'Could not load the replacements',
  );
  return ((await response.json()) as AdminJobsResponse).jobs;
}

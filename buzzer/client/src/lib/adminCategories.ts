// The admin dashboard's requests (F111): the category list, starting a generation or a
// regenerate, polling a job, and publishing or deleting a whole category. A 401 ends the session,
// as on the Built-in tab; any other failure throws the server's message.

import type {
  AdminCategoriesResponse,
  AdminDeleteCategoryResponse,
  AdminPublishAllErrorBody,
  AdminPublishAllResponse,
  GenerateBody,
  GenerateJob,
  GenerateStartResponse,
} from '../../../shared/types.js';
import { adminGet, checked } from './adminBuiltIns.js';
import { adminWrite } from './adminSession.js';
import { refreshBuiltInSets } from './builtInSets.js';

const categoryPath = (name: string) => `/categories/${encodeURIComponent(name)}`;

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

/** `GET /api/admin/jobs/:id`. */
export async function loadJob(id: string): Promise<GenerateJob> {
  const response = await checked(
    await adminGet(`/jobs/${encodeURIComponent(id)}`),
    'Could not load the generation',
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
  }
  await checked(response, 'Could not publish');
  refreshBuiltInSets();
  return { ok: true, published: ((await response.json()) as AdminPublishAllResponse).published };
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

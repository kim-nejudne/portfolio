// The generation history's request and how its page writes an entry (spec: Generation history
// `/admin/history`), ported from Buzzr's. The log is the server's, newest first, with totals over
// the whole of it.

import type { AdminHistoryResponse, GenerationHistoryEntry } from '#shared/types.js';
import { LEVEL_LABELS } from './adminCategories.js';
import { UNREACHABLE, adminSessionEnded, errorFrom } from './adminSession.js';

/** `GET /api/admin/history`: the newest entries (500 by default; 0 for the totals alone). */
export async function loadHistory(limit?: number): Promise<AdminHistoryResponse> {
  let response: Response;
  try {
    response = await fetch(`/api/admin/history${limit === undefined ? '' : `?limit=${limit}`}`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  if (response.status === 401) adminSessionEnded();
  if (!response.ok) throw await errorFrom(response, 'Could not load the history');
  return (await response.json()) as AdminHistoryResponse;
}

const KIND_TEXT: Record<GenerationHistoryEntry['kind'], string> = {
  generate: 'Generate',
  regenerate: 'Regenerate',
  replace: 'Replace',
  add: 'Add a place',
};
export const kindText = (kind: GenerationHistoryEntry['kind']) => KIND_TEXT[kind];

const OUTCOME_TEXT: Record<GenerationHistoryEntry['outcome'], string> = {
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
export const outcomeText = (outcome: GenerationHistoryEntry['outcome']) => OUTCOME_TEXT[outcome];

/** "Easy, Medium". */
export const levelsText = (levels: GenerationHistoryEntry['levels']) =>
  levels.map((l) => LEVEL_LABELS[l]).join(', ');

/** "Cities 15 · Landmarks 12": places saved per mode. */
export const savedText = ({ saved }: GenerationHistoryEntry) =>
  `Cities ${saved.city} · Landmarks ${saved.landmark}`;

/** "Not on Wikidata ×3", one per reason; empty when nothing was dropped. */
export const droppedLines = ({ dropped }: GenerationHistoryEntry) =>
  dropped.map(({ reason, count }) => `${reason} ×${count}`);

/** When the job ended, in the browser's locale and time zone: "8 Nov 2026, 13:28". */
export const whenText = (epochMs: number) =>
  new Date(epochMs).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

/** "The newest 500 of 731 jobs.", or null when every job is listed. */
export const shownText = (shown: number, jobs: number) =>
  shown < jobs ? `The newest ${shown} of ${jobs} jobs.` : null;

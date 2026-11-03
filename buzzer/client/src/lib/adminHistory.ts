// The generation history's request and how its page writes an entry (F128): the log itself is
// the server's (F127), newest first, with totals over the whole of it.

import { DIFFICULTY_LABELS } from '../../../shared/constants.js';
import type { AdminHistoryResponse, GenerationHistoryEntry } from '../../../shared/types.js';
import { adminGet, checked } from './adminBuiltIns.js';

/** `GET /api/admin/history`: the newest `HISTORY_LIMIT_DEFAULT` entries and the totals. */
export async function loadHistory(): Promise<AdminHistoryResponse> {
  const response = await checked(await adminGet('/history'), 'Could not load the history');
  return (await response.json()) as AdminHistoryResponse;
}

const KIND_TEXT: Record<GenerationHistoryEntry['kind'], string> = {
  generate: 'Generate',
  regenerate: 'Regenerate',
  // The log does not tell a replacement from an addition: both are one question asked for.
  replace: 'Replace or add',
};

export const kindText = (kind: GenerationHistoryEntry['kind']): string => KIND_TEXT[kind];

const OUTCOME_TEXT: Record<GenerationHistoryEntry['outcome'], string> = {
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const outcomeText = (outcome: GenerationHistoryEntry['outcome']): string =>
  OUTCOME_TEXT[outcome];

/** "Easy 15 · Medium 15": what the job asked for. */
export function levelsText(levels: GenerationHistoryEntry['levels']): string {
  return levels.map((l) => `${DIFFICULTY_LABELS[l.difficulty]} ${l.count}`).join(' · ');
}

/** "28 of 30": the questions saved, of those asked for. */
export function savedText(entry: GenerationHistoryEntry): string {
  const asked = entry.levels.reduce((sum, l) => sum + l.count, 0);
  return `${entry.saved} of ${asked}`;
}

/** When the job ended, in the browser's locale and time zone: "3 Nov 2026, 13:28". */
export function whenText(epochMs: number): string {
  return new Date(epochMs).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

/** "The newest 50 of 73 jobs.", or null when every job is listed. */
export function shownText(shown: number, jobs: number): string | null {
  return shown < jobs ? `The newest ${shown} of ${jobs} jobs.` : null;
}

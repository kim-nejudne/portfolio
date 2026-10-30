// **Import to built-ins** (F106): a file of one set, `{sets: [...]}` or a bare array, read as the
// browser's Import JSON reads it (F102). Each good set goes live at once, replacing the set with its
// id or appended; each bad one is listed with its reasons, and the rest still import.

import { BUILT_IN_SETS_MAX } from '../shared/constants.js';
import { SAMPLE_SET_ID } from '../shared/sampleSet.js';
import { questionSetSchema } from '../shared/schemas.js';
import { describePath, entryLabel, fillFromTitle } from '../shared/setFile.js';
import type { AdminImportResponse, QuestionSet, RejectedSet } from '../shared/types.js';
import type { BuiltInData } from './builtInStore.js';

/** A refused set lists at most this many reasons, then "…and N more." */
const ERRORS_SHOWN = 10;

/** The file's sets, or why the file as a whole cannot be read. */
export function fileEntries(
  json: unknown,
): { ok: true; entries: unknown[] } | { ok: false; error: string } {
  if (Array.isArray(json)) {
    return json.length > 0
      ? { ok: true, entries: json }
      : { ok: false, error: 'The file has no sets' };
  }
  // As in the browser: an object with `sets` and no `questions` is an **Export all** file.
  const isMany =
    typeof json === 'object' &&
    json !== null &&
    Object.hasOwn(json, 'sets') &&
    !Object.hasOwn(json, 'questions');
  if (!isMany) return { ok: true, entries: [json] };
  const { sets } = json as { sets: unknown };
  if (!Array.isArray(sets)) return { ok: false, error: 'Sets: must be a list of sets' };
  if (sets.length === 0) return { ok: false, error: 'The file has no sets' };
  return { ok: true, entries: sets };
}

function capped(errors: string[]): string[] {
  const shown = errors.slice(0, ERRORS_SHOWN);
  if (errors.length > shown.length) shown.push(`…and ${errors.length - shown.length} more.`);
  return shown;
}

/** One entry as a built-in set, or why it cannot be one. */
function checkEntry(
  entry: unknown,
): { ok: true; set: QuestionSet } | { ok: false; errors: string[] } {
  const parsed = questionSetSchema.safeParse(entry);
  if (!parsed.success) {
    return {
      ok: false,
      errors: capped(parsed.error.issues.map((i) => `${describePath(i.path)}: ${i.message}`)),
    };
  }
  const set = fillFromTitle(parsed.data);
  // Text only: a server built-in's pictures would have nowhere to live (DECISIONS F103).
  const pictured = set.questions.flatMap((q, i) => (q.imageId === undefined ? [] : [i + 1]));
  if (pictured.length > 0) {
    return {
      ok: false,
      errors: [
        `Built-in sets cannot have pictures (${pictured.length === 1 ? 'question' : 'questions'} ${pictured.join(', ')})`,
      ],
    };
  }
  // The bundled sample's pictures are found by this id, so no server set may take it.
  if (set.id === SAMPLE_SET_ID) {
    return { ok: false, errors: ['Id: this id belongs to the bundled sample set'] };
  }
  return { ok: true, set };
}

/**
 * Applies a file's sets to the built-ins: a set whose id is live replaces it in place, a new id is
 * appended while there are fewer than `BUILT_IN_SETS_MAX`. Drafts are left alone. A second set with
 * an id already used in this file is refused, so the file cannot overwrite itself.
 */
export function importBuiltIns(
  data: BuiltInData,
  entries: readonly unknown[],
): { data: BuiltInData; result: AdminImportResponse } {
  const sets = [...data.sets];
  const seen = new Set<string>();
  const rejected: RejectedSet[] = [];
  let added = 0;
  let replaced = 0;

  entries.forEach((entry, index) => {
    const label = entryLabel(entry, index);
    const checked = checkEntry(entry);
    if (!checked.ok) return rejected.push({ label, errors: checked.errors });
    const { set } = checked;
    if (seen.has(set.id)) {
      return rejected.push({ label, errors: ['Id: another set in this file has the same id'] });
    }
    const at = sets.findIndex((s) => s.id === set.id);
    if (at === -1 && sets.length >= BUILT_IN_SETS_MAX) {
      return rejected.push({
        label,
        errors: [`The built-ins are full (${BUILT_IN_SETS_MAX} sets). Delete some first.`],
      });
    }
    seen.add(set.id);
    if (at === -1) {
      sets.push(set);
      added += 1;
    } else {
      sets[at] = set;
      replaced += 1;
    }
  });

  return { data: { ...data, sets }, result: { added, replaced, rejected } };
}

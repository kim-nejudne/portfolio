// The built-in library (Set list `/sets`, Built-in tab): the bundled sample, then the server's
// built-in sets (DECISIONS F103–F107). Fetched once per page load and shared by every list.

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import { questionSetSchema } from '../../../shared/schemas.js';
import type { BuiltInSetsResponse, QuestionSet } from '../../../shared/types.js';

export const BUILT_IN_LOAD_ERROR = "Couldn't load the built-in sets.";

/** The built-in list a response gives: the sample first unless the admin hid it. */
export function builtInList({ sets, sampleHidden }: BuiltInSetsResponse): readonly QuestionSet[] {
  return sampleHidden ? sets : [SAMPLE_SET, ...sets];
}

// Checked like any set from outside the browser, so a bad set never reaches a list's renderer.
const responseSchema = z.object({ sets: z.array(questionSetSchema), sampleHidden: z.boolean() });

/** `GET /api/built-in-sets`. Throws when the server cannot answer or the body is not the list. */
async function fetchBuiltInSets(): Promise<readonly QuestionSet[]> {
  const response = await fetch('/api/built-in-sets');
  const parsed = responseSchema.safeParse(await response.json().catch(() => null));
  if (!response.ok || !parsed.success) throw new Error(BUILT_IN_LOAD_ERROR);
  return builtInList(parsed.data);
}

// The one request of this page load. A failed one is forgotten, so the next call (Retry) asks again.
let pending: Promise<readonly QuestionSet[]> | null = null;

/** The built-in sets, fetched on the first call and reused after. Rejects when the fetch fails. */
export function loadBuiltInSets(): Promise<readonly QuestionSet[]> {
  if (pending) return pending;
  const request = fetchBuiltInSets().catch((caught: unknown) => {
    if (pending === request) pending = null;
    throw new Error(BUILT_IN_LOAD_ERROR, { cause: caught });
  });
  pending = request;
  return request;
}

/**
 * Forgets the fetched list, so the next load asks the server again, or with `next`, uses that
 * response as if it had been fetched (an admin change that already has the new list; tests).
 */
export function resetBuiltInSets(next?: BuiltInSetsResponse): void {
  pending = next ? Promise.resolve(builtInList(next)) : null;
}

const refreshListeners = new Set<() => void>();

/**
 * After an admin change (F106): forgets the list and has every `useBuiltInSets` fetch it again.
 * Each keeps showing the old list until the new one arrives, so a list keeps its search and scroll.
 */
export function refreshBuiltInSets(): void {
  resetBuiltInSets();
  for (const listener of refreshListeners) listener();
}

export type BuiltInSetsState =
  | { kind: 'loading' }
  | { kind: 'failed'; retry: () => void }
  | { kind: 'ready'; sets: readonly QuestionSet[] };

/** The built-in sets for a component: loading, then the list, or a failure with `retry`. */
export function useBuiltInSets(): BuiltInSetsState {
  const [attempt, setAttempt] = useState(0);
  // Bumped by `refreshBuiltInSets`. Unlike a retry, it shows the last list, not loading, meanwhile.
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    sets: readonly QuestionSet[] | null;
  } | null>(null);

  useEffect(() => {
    const listener = () => setVersion((n) => n + 1);
    refreshListeners.add(listener);
    return () => {
      refreshListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    let live = true;
    loadBuiltInSets().then(
      (sets) => live && setResult({ attempt, sets }),
      () => live && setResult({ attempt, sets: null }),
    );
    return () => {
      live = false;
    };
  }, [attempt, version]);

  // A retry shows loading until its own answer, not the last attempt's failure.
  if (result === null || result.attempt !== attempt) return { kind: 'loading' };
  if (result.sets === null) return { kind: 'failed', retry: () => setAttempt((n) => n + 1) };
  return { kind: 'ready', sets: result.sets };
}

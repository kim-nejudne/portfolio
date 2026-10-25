// A Dexie query the page re-renders on (§7 Store): `liveQuery` from Dexie itself (no extra
// package) re-runs the query whenever a table it read changes, in this tab or another. `key`
// names the query: a new key starts a new subscription and reads `undefined` (loading) until
// its first result, so a page never shows one lesson's rows on another lesson.
import { liveQuery } from 'dexie';
import { useEffect, useRef, useState } from 'react';

export function useLiveQuery<T>(
  key: string,
  query: () => Promise<T>,
): T | undefined {
  const latest = useRef(query);
  useEffect(() => {
    latest.current = query;
  });
  const [state, setState] = useState<{ key: string; value: T } | null>(null);
  useEffect(() => {
    const subscription = liveQuery(() => latest.current()).subscribe({
      next: (value) => setState({ key, value }),
      error: (error: unknown) => {
        console.error('[store]', error);
      },
    });
    return () => subscription.unsubscribe();
  }, [key]);
  return state?.key === key ? state.value : undefined;
}

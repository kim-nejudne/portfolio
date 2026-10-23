export type Size = 'small' | 'medium' | 'large';

export type Summary = { total: number; sizes: Size[] };

/** 'small' below 10 items, 'medium' below 100, 'large' from 100 on. */
export function sizeOf(count: number): Size {
  if (count < 10) return 'small';
  if (count < 100) return 'medium';
  return 'large';
}

/** The sum of the counts, and the size of each count, in order. */
export function summarize(counts: readonly number[]): Summary {
  let sum = 0;
  for (const count of counts) {
    sum += count;
  }
  return { total: sum, sizes: counts.map(sizeOf) };
}

/** What `summarize` returns for no counts at all. */
export const EMPTY: Summary = summarize([]);

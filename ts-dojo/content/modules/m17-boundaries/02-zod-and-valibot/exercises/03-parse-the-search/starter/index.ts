import { z } from 'zod';

/** The search page's query string, parsed. Only `q` so far: see the prompt. */
export const SearchQuery = z.object({
  q: z.string(),
});

export type SearchInput = z.input<typeof SearchQuery>;
export type Search = z.output<typeof SearchQuery>;

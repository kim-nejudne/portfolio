import { z } from 'zod';

/** The search page's query string, parsed. */
export const SearchQuery = z.object({
  q: z.string().trim().min(1),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default(1),
  tags: z
    .string()
    .transform((text) =>
      text
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ''),
    )
    .default([]),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export type SearchInput = z.input<typeof SearchQuery>;
export type Search = z.output<typeof SearchQuery>;

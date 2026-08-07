/**
 * Generate `public/robots.txt` and `public/sitemap.xml`.
 *
 * The site has never had either. That was survivable while every unknown path
 * answered 200 — a sitemap listing six URLs means little on a site where six
 * million URLs also return a page — but the spokes now return real 404s, so a
 * sitemap is a statement a crawler can act on rather than a formality.
 *
 * Generated rather than hand-written for the reason everything else here is:
 * the hub has six pages and five of them are `SPOKES`. A hand-maintained
 * sitemap is a file nobody opens again, and the failure is silent — a spoke
 * added to `spokes.ts` would get an index row, a card, a case study and a
 * verify assertion, and would be missing from exactly one place, with nothing
 * to say so.
 *
 * Run by `prebuild` alongside `case-studies.mjs`, so neither entry point
 * depends on anybody remembering. `npm run seo` runs it alone.
 *
 * Usage: node scripts/seo.mjs
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* Same import the case-study generator uses, for the same reason: one typed
   source, no regex-parsing and no duplicate JSON. Node has stripped types
   since 22.18. */
const { SPOKES } = await import('../src/spokes.ts').catch((err) => {
  throw new Error(
    `Could not import src/spokes.ts (node ${process.version}).\n` +
      `This script relies on Node's built-in TypeScript type stripping,\n` +
      `unflagged since 22.18. Upgrade Node.\n\n${err.message}`,
  );
});

const ORIGIN = 'https://kimnejudne.dev';
const root = (p) => fileURLToPath(new URL(p, import.meta.url));

/*
 * The homepage first, then the case-study index, then one entry per case study.
 *
 * The spokes themselves are deliberately absent. They live on their own
 * origins, and a sitemap may only list URLs under the host that serves it —
 * a cross-host entry is ignored at best and treated as an error at worst.
 * Each spoke carries its own sitemap for its own pages.
 */
const urls = [`${ORIGIN}/`, `${ORIGIN}/work/`, ...SPOKES.map((s) => `${ORIGIN}/work/${s.id}/`)];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (loc) => `  <url>
    <loc>${loc}</loc>
    <changefreq>monthly</changefreq>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

/*
 * No `Disallow` anywhere: every page on this origin is public and meant to be
 * found. `Allow: /` is redundant against an empty disallow list and is written
 * anyway, because a robots.txt whose body is only a `Sitemap:` line reads like
 * a truncated file.
 */
const robots = `User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`;

writeFileSync(root('../public/robots.txt'), robots, 'utf8');
writeFileSync(root('../public/sitemap.xml'), sitemap, 'utf8');

console.log(`  public/robots.txt`);
console.log(
  `  public/sitemap.xml  ← ${urls.length} URLs (home + /work/ + ${SPOKES.length} case studies)`,
);

/**
 * Generate `public/robots.txt` and `public/sitemap.xml`.
 *
 * Neither existed. Until the catch-all in `server.ts` was fixed both of these
 * paths returned the app shell at status 200, so a crawler asking for
 * `/robots.txt` was told "here is a steakhouse homepage, and it is fine" —
 * which is worse than a 404, because a 404 is an answer.
 *
 * Generated from `src/routes.ts`, the same file `server.ts` uses to decide a
 * status code and `App.tsx` uses to render its routes. Three consumers, one
 * list. A hand-written sitemap would be a fourth copy of the route table and
 * the only one nothing checks.
 *
 * Run by `prebuild`, so `npm run build` cannot produce a `dist/` without them.
 *
 * Usage: node scripts/seo.mjs
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

/* Node has stripped types since 22.18, so a .mjs can import a .ts directly. */
const { SITEMAP_ROUTES, ROUTE_PREFIXES } = await import('../src/routes.ts').catch((err) => {
  throw new Error(
    `Could not import src/routes.ts (node ${process.version}).\n` +
      `This script relies on Node's built-in TypeScript type stripping,\n` +
      `unflagged since 22.18. Upgrade Node.\n\n${err.message}`,
  );
});

const ORIGIN = 'https://tallow.kimnejudne.dev';
const root = (p) => fileURLToPath(new URL(p, import.meta.url));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAP_ROUTES.map(
  (r) => `  <url>
    <loc>${ORIGIN}${r}</loc>
    <changefreq>${r === '/menu' ? 'weekly' : 'monthly'}</changefreq>
  </url>`,
).join('\n')}
</urlset>
`;

/*
 * `/menu` is weekly and the rest monthly, and that is a claim about the product
 * rather than a default: the 86 board and the dish of the day are edited from
 * the staff console during service, so the menu is the one page here whose
 * content genuinely moves. Saying "monthly" about it would be inaccurate; every
 * other page is prose that changes when someone rewrites it.
 */

/*
 * `/staff` is disallowed rather than merely left out of the sitemap.
 *
 * Absence from a sitemap is not an instruction — a crawler that finds the link
 * in the footer will follow it regardless. This is the instruction. It is not a
 * security control and is not doing security's job: every `/api/admin/*` route
 * is guarded server-side and a `demo` write is refused with a 403. It is here so
 * a staff console does not turn up in a search result.
 */
const robots = `User-agent: *
Allow: /
Disallow: ${ROUTE_PREFIXES.staff}

Sitemap: ${ORIGIN}/sitemap.xml
`;

mkdirSync(root('../public'), { recursive: true });
writeFileSync(root('../public/robots.txt'), robots, 'utf8');
writeFileSync(root('../public/sitemap.xml'), sitemap, 'utf8');

console.log(`  public/robots.txt   (Disallow: ${ROUTE_PREFIXES.staff})`);
console.log(`  public/sitemap.xml  ← ${SITEMAP_ROUTES.length} of the app's routes`);

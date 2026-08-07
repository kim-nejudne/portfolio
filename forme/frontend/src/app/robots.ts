import type { MetadataRoute } from 'next';

/**
 * `/robots.txt`, emitted by Next from this file.
 *
 * There was none, and until the SPA-fallback work landed elsewhere in the
 * portfolio this app at least answered honestly: `/robots.txt` was a real 404.
 * A 404 is a legal answer — a crawler treats it as "no restrictions" — but it
 * says nothing about where the sitemap is, and it leaves the four authed
 * surfaces to be discovered by following links.
 *
 * The disallow list is **not a security control** and is not doing security's
 * job. Every route under these prefixes is guarded three deep: the API verifies
 * the JWT and scopes every read, each route group's `layout.tsx` resolves the
 * session server-side, and `middleware.ts` redirects a visitor with no cookie.
 * This is here so a job list or a press floor board does not turn up in a
 * search result — and so crawl budget goes to the pages that are meant to be
 * found rather than to four redirects.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = process.env.FORME_PUBLIC_URL ?? 'https://forme.kimnejudne.dev';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app', '/prepress', '/floor', '/admin'],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}

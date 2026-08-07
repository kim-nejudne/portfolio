import type { MetadataRoute } from 'next';

/**
 * `/sitemap.xml`, emitted by Next from this file.
 *
 * A route handler rather than a static file in `public/`, because that is the
 * framework's own seam for it and because `public/` on this app is served out
 * of the standalone image — a path that had to be taught to copy `public/` at
 * all when the share card was added. One fewer thing to remember.
 *
 * **Only the four marketing routes.** Everything else this app has —
 * `/app`, `/prepress`, `/floor`, `/admin` — sits behind a session and would be
 * a redirect to `/sign-in` for a crawler, which is a page it already has.
 * Listing them would be advertising doors rather than describing the shop.
 *
 * The origin comes from `metadataBase` in `layout.tsx`, so a deployment under a
 * different hostname produces a correct sitemap without editing this file.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.FORME_PUBLIC_URL ?? 'https://forme.kimnejudne.dev';

  return [
    { url: `${origin}/`, changeFrequency: 'monthly', priority: 1 },
    /*
     * The artwork specification is the page this shop is actually looked up
     * for — a designer searching "trade printer bleed spec Manila" wants this
     * one, not the homepage — so it is weekly and second in priority.
     */
    { url: `${origin}/specs`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${origin}/quote`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${origin}/sign-in`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}

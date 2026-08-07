/**
 * One place that knows what each route is called.
 *
 * `title` is the document title; `label` is what a screen reader hears
 * announced after a client-side navigation. They differ because the tab needs
 * the brand and the announcement does not — hearing "TALLOW" before every page
 * name gets old fast when it is read aloud on each route change.
 */
export interface PageMeta {
  title: string;
  label: string;
}

const SUFFIX = ' — TALLOW';

const EXACT: Record<string, PageMeta> = {
  '/': { title: 'TALLOW — Dry-Aged, Live-Fire Steakhouse', label: 'Overview' },
  '/menu': { title: `The Printed Menu${SUFFIX}`, label: 'The printed menu' },
  '/story': { title: `The Craft${SUFFIX}`, label: 'The craft' },
  '/visit': { title: `Location & Hours${SUFFIX}`, label: 'Location and hours' },
  '/reserve': { title: `Reserve a Sitting${SUFFIX}`, label: 'Reserve a sitting' },
  '/confirmation': { title: `Your Sitting${SUFFIX}`, label: 'Your sitting' },
};

const STAFF: PageMeta = {
  title: `Staff Service Console${SUFFIX}`,
  label: 'Staff service console',
};

const NOT_FOUND: PageMeta = {
  title: `Page Not Found${SUFFIX}`,
  label: 'Page not found',
};

export function pageMetaFor(pathname: string): PageMeta {
  const exact = EXACT[pathname];
  if (exact) return exact;
  if (pathname === '/staff' || pathname.startsWith('/staff/')) return STAFF;
  return NOT_FOUND;
}

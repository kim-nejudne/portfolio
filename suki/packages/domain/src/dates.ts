// Date helpers. `today` is computed ONCE at app start and passed via session, so
// nothing else in the app calls new Date() in a render path.

export type PaydayKind = 'kinsenas' | 'katapusan' | null;

/** Returns 'kinsenas' on the 15th, 'katapusan' on the last day of the month, else null. */
export function paydayKindFor(iso: string): PaydayKind {
  const d = new Date(iso);
  const day = d.getUTCDate();
  if (day === 15) return 'kinsenas';
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day + 1));
  if (next.getUTCMonth() !== d.getUTCMonth()) return 'katapusan';
  return null;
}

/** Whole days between two ISO dates (positive = later). */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** How many days from `iso` until the next payday. Same day = 0. */
export function daysUntilNextPayday(iso: string): { kind: 'kinsenas' | 'katapusan'; days: number } {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const candidates: { kind: 'kinsenas' | 'katapusan'; iso: string }[] = [];
  if (day <= 15) candidates.push({ kind: 'kinsenas', iso: new Date(Date.UTC(y, m, 15)).toISOString() });
  candidates.push({ kind: 'katapusan', iso: new Date(Date.UTC(y, m, lastDay)).toISOString() });
  if (day > 15 && day < lastDay) {
    // next month's kinsenas is closer than a katapusan already passed? katapusan is later this month; fine.
  }
  if (day >= lastDay) {
    candidates.push({ kind: 'kinsenas', iso: new Date(Date.UTC(y, m + 1, 15)).toISOString() });
    const nextLast = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
    candidates.push({ kind: 'katapusan', iso: new Date(Date.UTC(y, m + 1, nextLast)).toISOString() });
  }
  const withDays = candidates
    .map((c) => ({ ...c, days: daysBetween(iso, c.iso) }))
    .filter((c) => c.days >= 0)
    .sort((a, b) => a.days - b.days);
  const chosen = withDays[0]!;
  return { kind: chosen.kind, days: chosen.days };
}

/** Short human date, always deterministic given the ISO. e.g. '12 Sep'. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

/** ISO date (no time) for a Date object, or a passthrough for an already-ISO date. */
export function toIsoDate(iso: string): string {
  return iso.slice(0, 10);
}

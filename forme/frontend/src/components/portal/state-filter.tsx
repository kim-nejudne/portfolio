import Link from 'next/link';
import { JOB_STATE_LABEL } from '@/lib/domain';
import type { JobState } from '@/lib/types';

/** Filter state lives in the URL, so a filtered list is a link. */
export function StateFilter({
  counts,
  active,
  total,
  basePath = '/app',
}: {
  counts: readonly { state: JobState; count: number }[];
  active: string | null;
  total: number;
  basePath?: string;
}) {
  return (
    <nav aria-label="Filter by state" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link
        href={basePath}
        aria-current={active === null ? 'page' : undefined}
        data-testid="filter-all"
        className={`label-caps border-b pb-0.5 transition-colors duration-100 ${
          active === null ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
        }`}
      >
        All <span className="num">{total}</span>
      </Link>
      {counts.map((entry) => (
        <Link
          key={entry.state}
          href={`${basePath}?state=${entry.state}`}
          aria-current={active === entry.state ? 'page' : undefined}
          data-testid={`filter-${entry.state}`}
          className={`label-caps border-b pb-0.5 transition-colors duration-100 ${
            active === entry.state
              ? 'border-ink text-ink'
              : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {JOB_STATE_LABEL[entry.state]} <span className="num">{entry.count}</span>
        </Link>
      ))}
    </nav>
  );
}

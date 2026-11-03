import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { AdminHistoryResponse, GenerationHistoryEntry } from '../../../shared/types.js';
import { AdminTile } from '../components/AdminTile.js';
import { categoryKey, categoryRoute, loadCategories } from '../lib/adminCategories.js';
import {
  kindText,
  levelsText,
  loadHistory,
  outcomeText,
  savedText,
  shownText,
  whenText,
} from '../lib/adminHistory.js';
import { cost } from '../lib/generationJob.js';
import { useDesktopLayout } from '../lib/useMediaQuery.js';
import { BUTTON_SECONDARY, LABEL, LINK } from '../lib/ui.js';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Category keys to the name their page goes by, for the entries whose category still exists. */
type Existing = ReadonlyMap<string, string>;

function CategoryName({ entry, existing }: { entry: GenerationHistoryEntry; existing: Existing }) {
  const name = existing.get(categoryKey(entry.category));
  if (name === undefined) return <span className="font-bold">{entry.category}</span>;
  return (
    <Link
      to={categoryRoute(name)}
      className={`${LINK} inline-flex min-h-11 items-center font-bold text-ink`}
    >
      {entry.category}
    </Link>
  );
}

function Outcome({ entry }: { entry: GenerationHistoryEntry }) {
  return (
    <span className={entry.outcome === 'failed' ? 'font-bold text-buzz' : undefined}>
      {outcomeText(entry.outcome)}
    </span>
  );
}

function ErrorText({ entry }: { entry: GenerationHistoryEntry }) {
  if (entry.outcome !== 'failed' || !entry.error) return null;
  return <span className="text-base text-buzz">{entry.error}</span>;
}

const CELL = 'px-3 py-2 align-top';

/** From `lg`: one row per job, seven columns. */
function HistoryTable({
  entries,
  existing,
}: {
  entries: GenerationHistoryEntry[];
  existing: Existing;
}) {
  return (
    <table className="w-full border-collapse text-left text-lg">
      <thead>
        <tr className="border-b-2 border-edge">
          {['When', 'Category', 'Kind', 'Levels', 'Saved', 'Cost', 'Outcome'].map((h) => (
            <th key={h} scope="col" className={`${CELL} ${LABEL}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, i) => (
          <tr key={`${entry.endedAt}-${i}`} className="border-b-2 border-edge">
            <td className={`${CELL} whitespace-nowrap text-muted`}>{whenText(entry.endedAt)}</td>
            <td className={CELL}>
              <CategoryName entry={entry} existing={existing} />
            </td>
            <td className={CELL}>{kindText(entry.kind)}</td>
            <td className={CELL}>{levelsText(entry.levels)}</td>
            <td className={`${CELL} whitespace-nowrap`}>{savedText(entry)}</td>
            <td className={`${CELL} whitespace-nowrap`}>{cost(entry.costUsd)}</td>
            <td className={CELL}>
              <span className="flex flex-col">
                <Outcome entry={entry} />
                <ErrorText entry={entry} />
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Below `lg`: each job stacked on a few short lines. */
function HistoryRows({
  entries,
  existing,
}: {
  entries: GenerationHistoryEntry[];
  existing: Existing;
}) {
  return (
    <ul aria-label="Generations" className="flex flex-col">
      {entries.map((entry, i) => (
        <li
          key={`${entry.endedAt}-${i}`}
          className="flex flex-col gap-1 border-b-2 border-edge py-3 text-lg"
        >
          {/* A long name wraps on its side; the outcome keeps the right. */}
          <span className="flex items-baseline justify-between gap-x-3">
            <CategoryName entry={entry} existing={existing} />
            <span className="shrink-0">
              <Outcome entry={entry} />
            </span>
          </span>
          <span className="text-muted">
            {whenText(entry.endedAt)} · {kindText(entry.kind)}
          </span>
          <span>
            {levelsText(entry.levels)} · saved {savedText(entry)} · {cost(entry.costUsd)}
          </span>
          <ErrorText entry={entry} />
        </li>
      ))}
    </ul>
  );
}

/**
 * `/admin/history` (F128): the spend today, over 30 days and in all, the number of jobs, then every
 * ended generation, replacement and addition, newest first. Full width, with no list pane.
 */
export function AdminHistory() {
  const desktop = useDesktopLayout();
  const [data, setData] = useState<AdminHistoryResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [existing, setExisting] = useState<Existing>(new Map());
  const mounted = useRef(true);

  const refresh = useCallback(() => {
    loadHistory().then(
      (next) => {
        if (!mounted.current) return;
        setData(next);
        setLoadError(null);
      },
      (err: unknown) => {
        if (mounted.current) setLoadError(message(err));
      },
    );
    // Only for the links: without the categories, the names show as plain text.
    loadCategories().then(
      (next) => {
        if (!mounted.current) return;
        setExisting(new Map(next.categories.map((c) => [categoryKey(c.name), c.name])));
      },
      () => {},
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const heading = (
    <h1 id="history-heading" className="font-display text-3xl">
      History
    </h1>
  );

  if (data === null) {
    return (
      <section aria-labelledby="history-heading" className="flex flex-col gap-4">
        {heading}
        {loadError ? (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="text-lg text-buzz">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => {
                setLoadError(null);
                refresh();
              }}
              className={BUTTON_SECONDARY}
            >
              Retry
            </button>
          </div>
        ) : (
          <p className="text-lg text-muted">Loading the history…</p>
        )}
      </section>
    );
  }

  const { entries, totals } = data;
  const shown = shownText(entries.length, totals.jobs);

  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-6">
      {heading}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminTile label="Today">
          <span className="font-display text-3xl">{cost(totals.todayUsd)}</span>
        </AdminTile>
        <AdminTile label="Last 30 days">
          <span className="font-display text-3xl">{cost(totals.last30DaysUsd)}</span>
        </AdminTile>
        <AdminTile label="All time">
          <span className="font-display text-3xl">{cost(totals.allTimeUsd)}</span>
        </AdminTile>
        <AdminTile label="Jobs">
          <span className="font-display text-3xl">{totals.jobs}</span>
        </AdminTile>
      </dl>
      {entries.length === 0 ? (
        <p className="text-lg text-muted">No generations yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {desktop ? (
            <HistoryTable entries={entries} existing={existing} />
          ) : (
            <HistoryRows entries={entries} existing={existing} />
          )}
          {shown && <p className="text-lg text-muted">{shown}</p>}
        </div>
      )}
      <p className="text-base text-muted">
        Spend is an estimate, counted by the UTC day each job ended. A job still running is listed
        once it ends.
      </p>
    </section>
  );
}

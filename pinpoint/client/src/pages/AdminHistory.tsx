import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { AdminHistoryResponse, GenerationHistoryEntry } from '#shared/types.js';
import { SpendTiles } from '../components/AdminCategories.js';
import { loadCategories } from '../lib/adminCategories.js';
import {
  droppedLines,
  kindText,
  levelsText,
  loadHistory,
  outcomeText,
  savedText,
  shownText,
  whenText,
} from '../lib/adminHistory.js';
import { cost } from '../lib/adminJobs.js';
import { BUTTON_SECONDARY, LINK, message } from '../lib/adminUi.js';

function CategoryName({
  entry,
  existing,
}: {
  entry: GenerationHistoryEntry;
  existing: Set<string>;
}) {
  if (!existing.has(entry.categoryId)) return <span className="font-bold">{entry.category}</span>;
  return (
    <Link to={`/admin/categories/${encodeURIComponent(entry.categoryId)}`} className={LINK}>
      {entry.category}
    </Link>
  );
}

// One job, stacked on a few short lines: the content column beside the list pane is too narrow
// for eight table columns (DECISIONS 53).
function Row({ entry, existing }: { entry: GenerationHistoryEntry; existing: Set<string> }) {
  const dropped = droppedLines(entry);
  return (
    <li className="flex flex-col gap-1 border-b border-line py-3">
      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
        <CategoryName entry={entry} existing={existing} />
        <span className={entry.outcome === 'failed' ? 'font-bold text-delayed' : 'font-semibold'}>
          {outcomeText(entry.outcome)}
        </span>
      </span>
      <span className="text-text-dim tabular-nums">
        {whenText(entry.endedAt)} · {kindText(entry.kind)} · {levelsText(entry.levels)} ·{' '}
        {cost(entry.costUsd)}
      </span>
      <span className="tabular-nums">Saved: {savedText(entry)}</span>
      {dropped.length === 0 ? (
        <span className="text-text-dim">Nothing dropped</span>
      ) : (
        <span className="flex flex-col">
          <span>Dropped:</span>
          <ul aria-label="Dropped" className="list-disc pl-6 text-text-dim">
            {dropped.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </span>
      )}
      {entry.outcome === 'failed' && entry.error && (
        <span className="text-delayed">{entry.error}</span>
      )}
    </li>
  );
}

/**
 * `/admin/history`: the spend today, over 30 days and in all, then every ended generation,
 * replacement and addition, newest first (spec: Generation history `/admin/history`).
 */
export function AdminHistory() {
  const [data, setData] = useState<AdminHistoryResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [existing, setExisting] = useState<Set<string>>(new Set());
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
    // Only for the links: without the categories, names show as plain text.
    loadCategories().then(
      (next) => {
        if (mounted.current) setExisting(new Set(next.categories.map((c) => c.id)));
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
    <h1 id="history-heading" className="text-3xl font-bold">
      History
    </h1>
  );

  if (data === null) {
    return (
      <section aria-labelledby="history-heading" className="flex flex-col gap-4">
        {heading}
        {loadError ? (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="text-delayed">
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
          <p role="status" className="text-text-dim">
            Loading the history…
          </p>
        )}
      </section>
    );
  }

  const { entries, totals } = data;
  const shown = shownText(entries.length, totals.jobs);

  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-6">
      {heading}
      <SpendTiles totals={totals} />
      {entries.length === 0 ? (
        <p className="text-text-dim">No generations yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <ul aria-label="Generations" className="flex flex-col">
            {entries.map((entry, i) => (
              <Row key={`${entry.endedAt}-${i}`} entry={entry} existing={existing} />
            ))}
          </ul>
          {shown && <p className="text-text-dim">{shown}</p>}
        </div>
      )}
      <p className="text-text-dim">
        Spend is an estimate, counted by the UTC day each job ended. A running job is listed once it
        ends.
      </p>
    </section>
  );
}

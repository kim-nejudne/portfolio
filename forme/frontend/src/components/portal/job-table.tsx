'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ProgressStrip } from '@/components/furniture/progress-strip';
import { StatusMark } from '@/components/furniture/status-mark';
import { formatInteger } from '@/lib/money';
import type { JobRow } from '@/lib/types';

type SortKey = 'reference' | 'description' | 'quantity' | 'state' | 'due';
type Direction = 'asc' | 'desc';

const COLUMNS: readonly { key: SortKey | null; label: string; className: string }[] = [
  { key: 'reference', label: 'Reference', className: 'w-[9.5rem]' },
  { key: 'description', label: 'Description', className: '' },
  { key: 'quantity', label: 'Quantity', className: 'w-[6rem] text-right' },
  { key: null, label: 'Stock', className: 'w-[11rem]' },
  { key: 'state', label: 'State', className: 'w-[12rem]' },
  { key: 'due', label: 'Due', className: 'w-[12.5rem]' },
  { key: null, label: 'Progress', className: 'w-[12rem]' },
];

function compare(a: JobRow, b: JobRow, key: SortKey): number {
  if (key === 'quantity') return a.quantity - b.quantity;
  if (key === 'due') return Date.parse(a.dueAt) - Date.parse(b.dueAt);
  if (key === 'state') return a.stateLabel.localeCompare(b.stateLabel);
  if (key === 'description') return a.description.localeCompare(b.description);
  return a.reference.localeCompare(b.reference);
}

export function JobTable({ rows }: { rows: readonly JobRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; direction: Direction }>({
    key: 'due',
    direction: 'asc',
  });

  const sorted = [...rows].sort((a, b) => {
    const result = compare(a, b, sort.key);
    return sort.direction === 'asc' ? result : -result;
  });

  function toggle(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  }

  return (
    <table className="w-full table-fixed border border-rule-strong text-sm" data-testid="job-table">
      <caption className="sr-only">
        Your jobs. Sortable by reference, description, quantity, state and due date.
      </caption>
      <thead>
        <tr className="border-b-2 border-rule-strong">
          {COLUMNS.map((column) => (
            <th
              key={column.label}
              scope="col"
              className={`px-2 py-2 text-left align-bottom label-caps ${column.className}`}
              aria-sort={
                column.key === null
                  ? undefined
                  : sort.key === column.key
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
              }
            >
              {column.key === null ? (
                column.label
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(column.key as SortKey)}
                  data-testid={`table-sort-button-${column.key}`}
                  className="label-caps inline-flex items-center gap-1 text-muted transition-colors duration-100 hover:text-ink"
                >
                  {column.label}
                  <span aria-hidden="true" className="num text-3xs">
                    {sort.key === column.key ? (sort.direction === 'asc' ? '\u25b2' : '\u25bc') : '\u2195'}
                  </span>
                </button>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={row.reference} className="h-8 border-b border-rule last:border-b-0 align-middle">
            <th scope="row" className="px-2 text-left font-normal">
              <Link
                href={row.href}
                data-testid={`job-link-${row.reference}`}
                className="num border-b border-transparent transition-colors duration-100 hover:border-ink"
              >
                {row.reference}
              </Link>
            </th>
            <td className="truncate px-2" title={row.description}>
              {row.description}
            </td>
            <td className="px-2 text-right num">{formatInteger(row.quantity)}</td>
            <td className="truncate px-2 num text-xs text-muted" title={row.stockLabel}>
              {row.stockLabel}
            </td>
            <td className="px-2">
              <StatusMark owner={row.owner} label={row.stateLabel} testId="status-mark" />
            </td>
            <td className="whitespace-nowrap px-2">
              <span className="num text-xs">{row.dueDate}</span>
              <span
                className={`num ml-2 text-2xs ${row.overdue ? 'text-magenta' : 'text-muted'}`}
              >
                {row.dueLabel}
              </span>
            </td>
            <td className="px-2">
              <ProgressStrip progress={row.progress} owner={row.owner} width={110} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

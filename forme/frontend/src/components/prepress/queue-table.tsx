'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { StatusMark } from '@/components/furniture/status-mark';
import { formatInteger } from '@forme/domain';
import type { QueueRow } from '@forme/domain';

type SortKey = 'reference' | 'customer' | 'quantity' | 'age' | 'due';
type Direction = 'asc' | 'desc';

const COLUMNS: readonly { key: SortKey | null; label: string; className: string }[] = [
  { key: 'reference', label: 'Reference', className: 'w-[9rem]' },
  { key: 'customer', label: 'Customer', className: 'w-[11rem]' },
  { key: null, label: 'Product', className: 'w-[8rem]' },
  { key: 'quantity', label: 'Qty', className: 'w-[5rem] text-right' },
  { key: null, label: 'Stock', className: 'w-[9.5rem]' },
  { key: null, label: 'Sheet', className: 'w-[4rem]' },
  { key: null, label: 'Sheets', className: 'w-[5rem] text-right' },
  { key: null, label: 'State', className: 'w-[11rem]' },
  { key: 'age', label: 'In queue', className: 'w-[6.5rem] text-right' },
  { key: 'due', label: 'Due', className: 'w-[15rem]' },
];

function compare(a: QueueRow, b: QueueRow, key: SortKey): number {
  if (key === 'quantity') return a.quantity - b.quantity;
  if (key === 'age') return a.ageMinutes - b.ageMinutes;
  if (key === 'due') return Date.parse(a.dueAt) - Date.parse(b.dueAt);
  if (key === 'customer') return a.customer.localeCompare(b.customer);
  return a.reference.localeCompare(b.reference);
}

export function QueueTable({ rows }: { rows: readonly QueueRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; direction: Direction }>({
    key: 'due',
    direction: 'asc',
  });
  const links = useRef<(HTMLAnchorElement | null)[]>([]);

  const sorted = [...rows].sort((a, b) => {
    const result = compare(a, b, sort.key);
    return sort.direction === 'asc' ? result : -result;
  });

  function move(index: number, delta: number) {
    const next = links.current[index + delta];
    if (next) next.focus();
  }

  return (
    <table className="w-full table-fixed border border-rule-strong text-xs" data-testid="queue-table">
      <caption className="sr-only">
        Every job awaiting preflight, imposition or a proof, across all customers. Sorted by due
        time. Use the up and down arrow keys to move between rows.
      </caption>
      <thead>
        <tr className="border-b-2 border-rule-strong">
          {COLUMNS.map((column) => (
            <th
              key={column.label}
              scope="col"
              className={`px-2 py-1.5 text-left align-bottom label-caps ${column.className}`}
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
                  onClick={() =>
                    setSort((current) =>
                      current.key === column.key
                        ? { key: current.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
                        : { key: column.key as SortKey, direction: 'asc' },
                    )
                  }
                  data-testid={`queue-sort-${column.key}`}
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
        {sorted.map((row, index) => (
          <tr
            key={row.reference}
            className="anim-row h-7 border-b border-rule last:border-b-0"
            style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
          >
            <th scope="row" className="px-2 text-left font-normal">
              <Link
                href={row.href}
                ref={(node) => {
                  links.current[index] = node;
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    move(index, 1);
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    move(index, -1);
                  }
                }}
                data-testid={`queue-link-${row.reference}`}
                className="num border-b border-transparent transition-colors duration-100 hover:border-ink"
              >
                {row.reference}
              </Link>
            </th>
            <td className="truncate px-2" title={row.customer}>
              {row.customer}
            </td>
            <td className="truncate px-2 text-muted">{row.productLabel}</td>
            <td className="px-2 text-right num">{formatInteger(row.quantity)}</td>
            <td className="truncate px-2 num text-muted" title={row.stockLabel}>
              {row.stockLabel}
            </td>
            <td className="px-2 num">{row.sheetLabel}</td>
            <td className="px-2 text-right num">{formatInteger(row.sheets)}</td>
            <td className="px-2">
              <StatusMark owner={row.owner} label={row.stateLabel} testId="status-mark" />
            </td>
            <td className="px-2 text-right num text-muted">{row.ageLabel}</td>
            <td className="whitespace-nowrap px-2">
              <span className="num">{row.dueDate}</span>
              <span className={`num ml-2 text-2xs ${row.overdue ? 'text-magenta' : 'text-muted'}`}>
                {row.overdue ? `OVERDUE ${row.dueLabel}` : row.dueLabel}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

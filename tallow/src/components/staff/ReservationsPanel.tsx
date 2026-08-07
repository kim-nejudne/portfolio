import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Reservation, ReservationStatus } from '../../types';
import { adminFetch } from '../../lib/session';
import { useStaffSession } from './StaffSessionContext';

interface ReservationsPanelProps {
  reservations: Reservation[];
  selectedDate: string;
  loading: boolean;
  onChanged: () => void;
}

/** Number-key shortcuts, in the order a table is worked during service. */
const STATUS_KEYS: Record<string, ReservationStatus> = {
  '1': 'seated',
  '2': 'confirmed',
  '3': 'completed',
  '4': 'cancelled',
};

const STATUS_STYLES: Record<ReservationStatus, string> = {
  seated: 'bg-[#7A2322] text-[#F7F4EE]',
  confirmed: 'bg-[#755C38] text-[#F7F4EE]',
  completed: 'bg-[#38322D] text-[#F7F4EE]',
  cancelled: 'bg-[#DDD6C8] text-[#1A1715]',
};

/** True when the keystroke belongs to a field rather than to the table. */
function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('input, select, textarea'));
}

export const ReservationsPanel: React.FC<ReservationsPanelProps> = ({
  reservations,
  selectedDate,
  loading,
  onChanged,
}) => {
  const { writeProps, writeClass, readOnly, reportActionError } = useStaffSession();

  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [focusedRowIndex, setFocusedRowIndex] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  const filterInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const fieldId = useId();

  const filtered = useMemo(() => {
    const needle = searchFilter.toLowerCase();
    return reservations.filter((r) => {
      const matchesDate = r.date === selectedDate;
      const matchesSearch =
        r.name.toLowerCase().includes(needle) ||
        r.token.toLowerCase().includes(needle) ||
        r.phone.includes(searchFilter) ||
        r.email.toLowerCase().includes(needle);
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchesDate && matchesSearch && matchesStatus;
    });
  }, [reservations, selectedDate, searchFilter, statusFilter]);

  // Filtering shrinks the list under the cursor. Without this the index can
  // point past the end and the shortcuts act on nothing.
  useEffect(() => {
    setFocusedRowIndex((i) => Math.max(0, Math.min(i, filtered.length - 1)));
  }, [filtered.length]);

  const handleStatusChange = useCallback(
    async (resv: Reservation, newStatus: ReservationStatus) => {
      if (readOnly) {
        reportActionError(
          new Error('read-only'),
          'Changes are disabled on the read-only preview.'
        );
        return;
      }
      try {
        const res = await adminFetch(`/api/admin/reservations/${resv.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        if (res.ok) {
          // A number-key press has no visible affordance; this is the only
          // feedback that the keystroke landed on the row it looked like.
          setAnnouncement(`${resv.name}, ${resv.time}: ${newStatus}.`);
          onChanged();
        }
      } catch (err) {
        reportActionError(err, 'Failed to update reservation status.');
      }
    },
    [readOnly, reportActionError, onChanged]
  );

  const moveFocusTo = (index: number) => {
    const clamped = Math.max(0, Math.min(index, filtered.length - 1));
    setFocusedRowIndex(clamped);
    rowRefs.current[clamped]?.focus();
  };

  /**
   * The scaffold bound these to `window`, so pressing j in the date picker or
   * k in the status filter moved the table cursor instead of typing. Scoping
   * the listener to the panel and ignoring form fields is the whole fix.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isTypingTarget(e.target)) {
      if (e.key === 'Escape') (e.target as HTMLElement).blur();
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      filterInputRef.current?.focus();
      return;
    }

    // Row commands only apply when the cursor is actually in the table.
    const inTable = e.target instanceof HTMLElement && e.target.closest('tbody');
    if (!inTable) return;

    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocusTo(focusedRowIndex + 1);
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocusTo(focusedRowIndex - 1);
    } else if (STATUS_KEYS[e.key]) {
      const target = filtered[focusedRowIndex];
      if (!target) return;
      e.preventDefault();
      handleStatusChange(target, STATUS_KEYS[e.key]);
    }
  };

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      <h2 className="sr-only">Reservation book for {selectedDate}</h2>

      {/* Keyboard Shortcuts Hint Bar */}
      <div className="p-3 bg-[#1A1715] text-[#F7F4EE] text-xs font-mono-data flex flex-wrap items-center justify-between gap-2 on-dark">
        <div className="flex items-center space-x-4">
          <span><kbd className="px-1.5 py-0.5 bg-[#7A2322] text-[#F7F4EE]">j</kbd> / <kbd className="px-1.5 py-0.5 bg-[#7A2322] text-[#F7F4EE]">k</kbd> Navigate Rows</span>
          <span><kbd className="px-1.5 py-0.5 bg-[#7A2322] text-[#F7F4EE]">/</kbd> Focus Filter</span>
          <span>
            Shortcuts: <kbd className="px-1.5 py-0.5 bg-[#38322D]">1</kbd> Seated ·{' '}
            <kbd className="px-1.5 py-0.5 bg-[#38322D]">2</kbd> Confirmed ·{' '}
            <kbd className="px-1.5 py-0.5 bg-[#38322D]">3</kbd> Completed ·{' '}
            <kbd className="px-1.5 py-0.5 bg-[#38322D]">4</kbd> Cancelled
          </span>
        </div>
        <span className="text-[#755C38]">{filtered.length} Bookings Shown</span>
      </div>

      <p aria-live="polite" className="sr-only">{announcement}</p>

      {/* Search and Status Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <label htmlFor={`${fieldId}-search`} className="sr-only">
            Filter bookings by name, phone, email or token
          </label>
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#665E56]" aria-hidden="true" />
          <input
            id={`${fieldId}-search`}
            ref={filterInputRef}
            type="search"
            placeholder="Press / to filter by name, phone, email, token..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#EFE6D5] border border-[#38322D] font-mono-data text-xs text-[#1A1715]"
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-status`} className="sr-only">
            Filter by status
          </label>
          <select
            id={`${fieldId}-status`}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#EFE6D5] border border-[#38322D] font-mono-data text-xs text-[#1A1715]"
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="seated">Seated</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Dense Table */}
      <div className="overflow-x-auto border border-[#38322D]">
        <table className="w-full text-left font-mono-data text-xs border-collapse">
          <caption className="sr-only">
            Bookings for {selectedDate}. Use j and k to move between rows, and the number keys 1 to 4
            to set a booking to seated, confirmed, completed or cancelled.
          </caption>
          <thead>
            <tr className="bg-[#1A1715] text-[#F7F4EE] border-b border-[#38322D] uppercase tracking-wider text-[10px]">
              <th scope="col" className="p-2.5">Time</th>
              <th scope="col" className="p-2.5">Token</th>
              <th scope="col" className="p-2.5">Guest Name</th>
              <th scope="col" className="p-2.5 text-center">Party</th>
              <th scope="col" className="p-2.5">Phone / Contact</th>
              <th scope="col" className="p-2.5">Notes</th>
              <th scope="col" className="p-2.5">Status</th>
              <th scope="col" className="p-2.5 text-right">Quick Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDD6C8]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-[#665E56] italic">
                  {loading
                    ? 'Loading the reservation book…'
                    : `No reservations found matching filter criteria for ${selectedDate}.`}
                </td>
              </tr>
            ) : (
              filtered.map((resv, idx) => {
                const isFocused = idx === focusedRowIndex;
                return (
                  <tr
                    key={resv.id}
                    ref={(el) => { rowRefs.current[idx] = el; }}
                    // Roving tabindex: the table is one tab stop, and the arrow
                    // keys move within it.
                    tabIndex={isFocused ? 0 : -1}
                    onFocus={() => setFocusedRowIndex(idx)}
                    onClick={() => moveFocusTo(idx)}
                    className={`transition-colors cursor-pointer ${
                      isFocused
                        ? 'bg-[#1A1715] text-[#F7F4EE]'
                        : resv.status === 'cancelled'
                        ? 'bg-[#1A1715]/5 text-[#8A827A] line-through'
                        : resv.status === 'seated'
                        ? 'bg-[#7A2322]/10 text-[#1A1715]'
                        : 'hover:bg-[#EFE6D5] text-[#1A1715]'
                    }`}
                  >
                    <td className="p-2.5 font-bold">{resv.time}</td>
                    <td className="p-2.5">{resv.token}</td>
                    <th scope="row" className="p-2.5 font-medium text-left">{resv.name}</th>
                    <td className="p-2.5 text-center font-bold">{resv.partySize}</td>
                    <td className="p-2.5">{resv.phone}</td>
                    <td className="p-2.5 max-w-xs truncate italic">{resv.notes || '—'}</td>
                    <td className="p-2.5 uppercase font-bold text-[10px]">
                      <span className={`px-2 py-0.5 ${STATUS_STYLES[resv.status]}`}>
                        {resv.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right space-x-1">
                      {([
                        ['Seat', 'seated', 'bg-[#7A2322] text-[#F7F4EE] hover:bg-[#581413]'],
                        ['Done', 'completed', 'bg-[#38322D] text-[#F7F4EE]'],
                        ['Cancel', 'cancelled', 'border border-[#7A2322] text-[#7A2322]'],
                      ] as const).map(([label, status, style]) => (
                        <button
                          key={status}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(resv, status);
                          }}
                          {...writeProps}
                          className={`px-2 py-1 text-[9px] uppercase ${style}${writeClass}`}
                        >
                          {label}
                          <span className="sr-only"> {resv.name}, {resv.time}</span>
                        </button>
                      ))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

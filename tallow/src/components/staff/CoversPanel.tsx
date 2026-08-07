import React from 'react';
import { CoverSummary } from '../../types';

interface CoversPanelProps {
  selectedDate: string;
  summary: CoverSummary | null;
  loading: boolean;
}

const SITTING_WINDOWS = [
  { key: 'early', label: 'Early Sitting (17:00 – 18:30)', accent: 'text-[#755C38]', figure: 'text-[#1A1715]' },
  { key: 'prime', label: 'Prime Sitting (18:30 – 20:30)', accent: 'text-[#7A2322]', figure: 'text-[#7A2322]' },
  { key: 'late', label: 'Late Sitting (20:30 – 22:30)', accent: 'text-[#755C38]', figure: 'text-[#1A1715]' },
] as const;

/** A figure that is not in yet reads as "—", not as a confident zero. */
function figure(loading: boolean, value: number | undefined) {
  if (loading && value === undefined) return '—';
  return value ?? 0;
}

export const CoversPanel: React.FC<CoversPanelProps> = ({ selectedDate, summary, loading }) => {
  return (
    <div className="space-y-8">
      <h2 className="sr-only">Covers and sittings for {selectedDate}</h2>

      <dl className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 bg-[#F7F4EE] border border-[#DDD6C8]">
          <dt className="text-[10px] font-mono-data uppercase text-[#665E56] block">Date</dt>
          <dd className="font-display text-2xl text-[#1A1715]">{selectedDate}</dd>
        </div>
        <div className="p-5 bg-[#F7F4EE] border border-[#DDD6C8]">
          <dt className="text-[10px] font-mono-data uppercase text-[#665E56] block">Total Booked Covers</dt>
          <dd className="font-display text-3xl text-[#7A2322]">{figure(loading, summary?.totalCovers)}</dd>
        </div>
        <div className="p-5 bg-[#F7F4EE] border border-[#DDD6C8]">
          <dt className="text-[10px] font-mono-data uppercase text-[#665E56] block">Total Parties</dt>
          <dd className="font-display text-3xl text-[#1A1715]">{figure(loading, summary?.totalReservations)}</dd>
        </div>
        <div className="p-5 bg-[#F7F4EE] border border-[#DDD6C8]">
          <dt className="text-[10px] font-mono-data uppercase text-[#665E56] block">Cap Capacity</dt>
          {/* Read from the summary rather than printed as a literal: the cap is
              configurable per deployment via MAX_SLOT_COVERS. */}
          <dd className="font-display text-2xl text-[#755C38]">
            {summary ? `${summary.maxSlotCovers} Covers / Sitting` : '—'}
          </dd>
        </div>
      </dl>

      {/* Sittings breakdown bar */}
      <section aria-labelledby="sitting-windows-heading" className="insert-stock p-6 border border-[#38322D]/20 space-y-4">
        <h3 id="sitting-windows-heading" className="font-display text-2xl text-[#1A1715]">
          Sitting Windows Summary
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono-data">
          {SITTING_WINDOWS.map(({ key, label, accent, figure: figureClass }) => (
            <div key={key} className="p-4 bg-[#F7F4EE] border border-[#DDD6C8]">
              <dt className={`${accent} uppercase block font-bold`}>{label}</dt>
              <dd className={`text-2xl font-display ${figureClass} mt-1 block`}>
                {figure(loading, summary?.sittingCounts[key])} Covers
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
};

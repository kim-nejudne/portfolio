'use client';

import { useEffect, useState } from 'react';
import { PressPanel } from '@/components/floor/press-panel';
import { subscribeToClock } from '@/lib/api/live';
import { subscribeToFloor } from '@/lib/api/live';
import { formatDate, formatTime, formatWeekday } from '@forme/domain';
import type { Press } from '@forme/domain';

/**
 * The board polls through the data layer. No timer lives in this component, and
 * the wall clock only starts once the board has mounted so the server render and
 * the first client render agree.
 */
export function FloorBoard({ initial }: { initial: readonly Press[] }) {
  const [presses, setPresses] = useState<readonly Press[]>(initial);
  const [clock, setClock] = useState<string | null>(null);

  // `initial` is the server-rendered snapshot and stays the seed for useState;
  // the subscription only needs somewhere to push updates.
  useEffect(() => subscribeToFloor(setPresses), []);
  useEffect(() => subscribeToClock(setClock), []);

  const running = presses.filter((press) => press.state === 'RUNNING').length;
  const waste = presses.reduce((sum, press) => sum + press.wasteSheets, 0);

  return (
    <div className="on-ink flex min-h-dvh flex-col bg-ink text-paper">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-rule-ink px-[1.5vw] py-[1vh]">
        <h1 className="num font-semibold tracking-[0.2em] text-[clamp(1rem,1.6vw,2rem)]">
          FORME PRESS FLOOR
        </h1>
        <p className="num text-muted-ink text-[clamp(0.6875rem,1vw,1.125rem)]">
          {running} of {presses.length} running · {waste} waste sheets today · shift 1
        </p>
        <p className="num text-right">
          <span className="block leading-none text-[clamp(1.75rem,3.2vw,4rem)]" data-testid="floor-clock">
            {clock === null ? '--:--' : formatTime(clock)}
          </span>
          <span className="block text-muted-ink text-[clamp(0.625rem,0.9vw,1rem)]">
            {clock === null ? 'SYNCHRONISING' : `${formatWeekday(clock)} ${formatDate(clock)}`}
          </span>
        </p>
      </header>

      <div className="grid flex-1 lg:grid-cols-3">
        {presses.map((press) => (
          <PressPanel key={press.id} press={press} />
        ))}
      </div>
    </div>
  );
}

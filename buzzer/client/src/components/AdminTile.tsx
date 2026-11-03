import type { ReactNode } from 'react';
import { CARD, LABEL } from '../lib/ui.js';

/** One figure of an admin summary, inside a `<dl>`: the overview's and the history's tiles. */
export function AdminTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={`${CARD} flex flex-col gap-1 p-4`}>
      <dt className={LABEL}>{label}</dt>
      <dd className="flex flex-col">{children}</dd>
    </div>
  );
}

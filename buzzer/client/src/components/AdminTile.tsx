import type { ReactNode } from 'react';
import { LABEL } from '../lib/ui.js';

/** One figure of an admin summary, inside a `<dl>`: a cell of the overview's and the history's ruled figure row (F151). */
export function AdminTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-edge py-3">
      <dt className={LABEL}>{label}</dt>
      <dd className="flex flex-col">{children}</dd>
    </div>
  );
}

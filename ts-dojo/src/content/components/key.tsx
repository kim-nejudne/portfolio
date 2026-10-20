// `<Key>gd</Key>` (spec §3 MDX components): a keystroke chip.
import type { ReactNode } from 'react';

export function Key({ children }: { children?: ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[0.8em]">
      {children}
    </kbd>
  );
}

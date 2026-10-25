// `<Key>gd</Key>` (spec §3 MDX components): a keystroke chip.
import type { ReactNode } from 'react';

export function Key({ children }: { children?: ReactNode }) {
  return <kbd className="bg-muted text-[0.85em]">{children}</kbd>;
}

// `<Callout kind="tip" | "warn" | "ts7">` (spec §3 MDX components): an aside in the theory.
import type { ReactNode } from 'react';
import { cn } from 'cn';

export type CalloutKind = 'tip' | 'warn' | 'ts7';

const LABEL: Record<CalloutKind, string> = {
  tip: 'Tip',
  warn: 'Watch out',
  ts7: 'TypeScript 7',
};

const STYLE: Record<CalloutKind, string> = {
  tip: 'border-primary/40 bg-primary/5',
  warn: 'border-destructive/40 bg-destructive/5',
  ts7: 'border-border bg-muted/50',
};

export function Callout({
  kind = 'tip',
  children,
}: {
  kind?: CalloutKind;
  children?: ReactNode;
}) {
  return (
    <aside
      className={cn(
        'callout my-4 rounded-md border px-4 py-3 text-sm',
        STYLE[kind],
      )}
      data-kind={kind}
    >
      <p className="m-0 mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {LABEL[kind]}
      </p>
      <div className="callout-body [&>p]:m-0">{children}</div>
    </aside>
  );
}

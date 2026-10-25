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
  tip: 'border-l-info [&>p]:text-info',
  warn: 'border-l-warning [&>p]:text-warning',
  ts7: 'border-l-ansi-magenta [&>p]:text-ansi-magenta',
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
        'callout my-4 border border-l-2 bg-muted/50 px-4 py-3 text-sm',
        STYLE[kind],
      )}
      data-kind={kind}
    >
      <p className="m-0 mb-1 font-mono text-xs font-semibold">
        <span aria-hidden="true">## </span>
        {LABEL[kind]}
      </p>
      <div className="callout-body [&>p]:m-0">{children}</div>
    </aside>
  );
}

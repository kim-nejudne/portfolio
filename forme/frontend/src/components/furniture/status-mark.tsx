import type { CheckSeverity, StateOwner } from '@/lib/types';

/**
 * Status is never colour alone. Every state carries a text label, a colour and a
 * distinct mark shape: square-with-dot, diamond, triangle, solid square.
 * The marks themselves are decoration over the label, so they are aria-hidden.
 */
const OWNER_CLASS: Record<StateOwner, string> = {
  system: 'text-cyan',
  human: 'text-magenta',
  held: 'text-yellow',
  final: 'text-ink',
};

function MarkShape({ owner, size = 12 }: { owner: StateOwner; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 12 12',
    'aria-hidden': true as const,
    focusable: 'false' as const,
    className: 'shrink-0',
  };
  if (owner === 'system') {
    return (
      <svg {...common}>
        <rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
        <rect x="5" y="5" width="2" height="2" fill="currentColor" />
      </svg>
    );
  }
  if (owner === 'human') {
    return (
      <svg {...common}>
        <path d="M6 0.5 11.5 6 6 11.5 0.5 6Z" fill="currentColor" />
      </svg>
    );
  }
  if (owner === 'held') {
    return (
      <svg {...common}>
        <path d="M6 1 11.5 11 0.5 11Z" fill="none" stroke="currentColor" strokeWidth="1.25" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="1" y="1" width="10" height="10" fill="currentColor" />
    </svg>
  );
}

export function StatusMark({
  owner,
  label,
  size = 12,
  onInk = false,
  testId,
}: {
  owner: StateOwner;
  label: string;
  size?: number;
  onInk?: boolean;
  testId?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2" data-testid={testId}>
      {/* The mark carries the colour; the label is always set in the current ink
          so every status label meets AA on both grounds. */}
      <span className={owner === 'final' ? (onInk ? 'text-paper' : 'text-ink') : OWNER_CLASS[owner]}>
        <MarkShape owner={owner} size={size} />
      </span>
      <span
        className={`label-caps whitespace-nowrap ${onInk ? 'text-paper' : 'text-ink'}`}
        data-testid="status-label"
      >
        {label}
      </span>
    </span>
  );
}

const SEVERITY_OWNER: Record<CheckSeverity, StateOwner> = {
  PASS: 'final',
  WARN: 'held',
  FAIL: 'human',
};

export function SeverityMark({
  severity,
  waived = false,
}: {
  severity: CheckSeverity;
  waived?: boolean;
}) {
  return (
    <StatusMark
      owner={waived ? 'final' : SEVERITY_OWNER[severity]}
      label={waived ? `${severity} WAIVED` : severity}
      testId="status-mark"
    />
  );
}

export function severityOwner(severity: CheckSeverity): StateOwner {
  return SEVERITY_OWNER[severity];
}

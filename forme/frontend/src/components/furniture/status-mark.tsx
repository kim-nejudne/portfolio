import { SEVERITY_LABEL } from '@forme/domain';
import type { CheckSeverity, StateOwner } from '@forme/domain';

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

/**
 * A fifth mark, for a check the engine did not run. It is deliberately not a
 * StateOwner: no job is ever "skipped", only a check is, and widening StateOwner
 * would put a meaningless state into every job timeline. Muted rather than
 * coloured, because it is neither good news nor an alarm — the report's own copy
 * explains why it did not run.
 */
function SkippedShape({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      aria-hidden
      focusable="false"
      className="shrink-0"
    >
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M2.8 9.2 9.2 2.8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

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

const SEVERITY_OWNER: Record<Exclude<CheckSeverity, 'SKIPPED'>, StateOwner> = {
  PASS: 'final',
  WARN: 'held',
  FAIL: 'human',
};

export function SeverityMark({
  severity,
  waived = false,
  kind,
}: {
  severity: CheckSeverity;
  waived?: boolean;
  kind?: 'WAIVED' | 'OVERRIDDEN';
}) {
  // A check that never ran cannot be waived — there is no finding to take
  // responsibility for — so SKIPPED wins over the waiver flag rather than
  // being dressed up as a pass somebody signed off.
  if (severity === 'SKIPPED') {
    return (
      <span className="inline-flex items-center gap-2" data-testid="status-mark">
        <span className="text-muted">
          <SkippedShape />
        </span>
        <span className="label-caps whitespace-nowrap text-ink" data-testid="status-label">
          {SEVERITY_LABEL.SKIPPED}
        </span>
      </span>
    );
  }
  return (
    <StatusMark
      owner={waived ? 'final' : SEVERITY_OWNER[severity]}
      label={waived ? (kind ?? 'WAIVED') : SEVERITY_LABEL[severity]}
      testId="status-mark"
    />
  );
}

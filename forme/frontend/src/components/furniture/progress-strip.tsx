import type { StateOwner } from '@/lib/types';

const SEGMENTS: readonly { key: string; className: string }[] = [
  { key: 'C', className: 'bg-cyan' },
  { key: 'M', className: 'bg-magenta' },
  { key: 'Y', className: 'bg-yellow' },
  { key: 'K', className: 'bg-ink' },
];

/**
 * The job's progress reads as a CMYK colour bar filling. Decorative: the number
 * beside it carries the meaning.
 */
export function ProgressStrip({
  progress,
  owner,
  width = 160,
  showValue = true,
}: {
  progress: number;
  owner: StateOwner;
  width?: number;
  showValue?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, progress));
  const stalled = owner === 'held' || (owner === 'final' && clamped === 0);
  return (
    <span className="inline-flex items-center gap-2" data-testid="job-progress-strip">
      <span
        aria-hidden="true"
        className="relative block h-2 overflow-hidden border border-rule-strong"
        style={{ width }}
      >
        <span
          className="anim-fill absolute inset-y-0 left-0 block overflow-hidden"
          style={{ width: `${clamped}%` }}
        >
          <span className="absolute inset-y-0 left-0 flex" style={{ width }}>
            {SEGMENTS.map((segment) => (
              <span
                key={segment.key}
                className={`block h-full ${segment.className}`}
                style={{ width: width / 4 }}
              />
            ))}
          </span>
        </span>
        {stalled ? (
          <span className="absolute inset-y-0 right-0 block w-1/2 border-l border-yellow" />
        ) : null}
      </span>
      {showValue ? (
        <span className="num text-2xs text-muted tabular-nums">{clamped}%</span>
      ) : null}
    </span>
  );
}

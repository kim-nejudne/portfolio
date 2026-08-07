/**
 * The registration target. Static it is a mark; spinning it is the processing
 * state. Decorative in both cases — the text beside it says what is happening.
 */
export function RegistrationTarget({
  size = 24,
  spinning = false,
  onInk = false,
}: {
  size?: number;
  spinning?: boolean;
  onInk?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={`${spinning ? 'anim-spin' : ''} ${onInk ? 'text-paper' : 'text-ink'}`}
      data-testid={spinning ? 'processing-registration-target' : 'registration-target'}
    >
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M12 0V6M12 18V24M0 12H6M18 12H24" stroke="currentColor" strokeWidth="1" />
      <path d="M12 9.5V14.5M9.5 12H14.5" stroke="currentColor" strokeWidth="0.75" />
    </svg>
  );
}

/** Corner crop marks, as they sit on a proof sheet. */
export function CropFrame({
  children,
  className = '',
  testId,
}: {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  const mark = (position: string, path: string) => (
    <svg
      className={`absolute ${position} text-muted`}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} stroke="currentColor" strokeWidth="1" />
    </svg>
  );
  return (
    <div className={`relative p-3 ${className}`} data-testid={testId}>
      {mark('left-0 top-0', 'M0 0.5H10M0.5 0V10')}
      {mark('right-0 top-0', 'M14 0.5H4M13.5 0V10')}
      {mark('bottom-0 left-0', 'M0 13.5H10M0.5 14V4')}
      {mark('bottom-0 right-0', 'M14 13.5H4M13.5 14V4')}
      {children}
    </div>
  );
}

/** A CMYK colour bar, as printed on the tail of every sheet. */
export function ColourBar({ height = 8 }: { height?: number }) {
  const patches = [
    'bg-cyan',
    'bg-magenta',
    'bg-yellow',
    'bg-ink',
    'bg-cyan/50',
    'bg-magenta/50',
    'bg-yellow/50',
    'bg-ink/50',
  ];
  return (
    <span aria-hidden="true" className="flex w-full border border-rule" style={{ height }}>
      {patches.map((patch) => (
        <span key={patch} className={`block flex-1 ${patch}`} />
      ))}
    </span>
  );
}

/** Tick marks, as on a drafting rule. */
export function TickRule({ ticks = 24 }: { ticks?: number }) {
  return (
    <span aria-hidden="true" className="flex h-2 w-full items-end justify-between">
      {Array.from({ length: ticks }, (_, index) => (
        <span
          key={index}
          className="block w-px bg-rule-strong"
          style={{ height: index % 5 === 0 ? 8 : 4 }}
        />
      ))}
    </span>
  );
}

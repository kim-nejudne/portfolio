import { paydayKindFor, daysUntilNextPayday } from '@suki/domain';

interface Props {
  today: string;
}

export function PaydayBand({ today }: Props) {
  const kind = paydayKindFor(today);
  if (!kind) {
    const upcoming = daysUntilNextPayday(today);
    return (
      <div className="px-4 py-2 rule" style={{ background: 'var(--color-paper)' }}>
        <p className="text-[13px] text-muted">
          Next payday: <span className="mono">{upcoming.kind}</span>, in {upcoming.days} day{upcoming.days === 1 ? '' : 's'}.
        </p>
      </div>
    );
  }
  const label = kind === 'kinsenas' ? 'Kinsenas' : 'Katapusan';
  return (
    <div
      role="status"
      className="anim-payday px-4 py-3 rule flex items-center justify-between"
      style={{ background: 'var(--color-ink)', color: 'var(--color-paper)' }}
    >
      <div>
        <p className="mono uppercase text-[12px]" style={{ letterSpacing: '0.1em' }}>Payday</p>
        <p className="text-[18px]">Today is {label}. Most suki will settle.</p>
      </div>
    </div>
  );
}

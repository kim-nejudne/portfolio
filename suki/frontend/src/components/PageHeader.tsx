import { NavLink } from 'react-router-dom';

interface Props {
  title: string;
  right?: React.ReactNode;
  back?: string;
}

export function PageHeader({ title, right, back }: Props) {
  return (
    <header className="rule px-4 pt-4 pb-3 flex items-end justify-between gap-3" style={{ background: 'var(--color-paper)' }}>
      <div className="min-w-0">
        {back && (
          <NavLink
            to={back}
            className="text-[12px] mono uppercase text-muted inline-flex items-center gap-1"
            style={{ minHeight: 'var(--tap-min)' }}
          >
            <span aria-hidden>←</span> Back
          </NavLink>
        )}
        <h1 className="text-[24px] leading-tight truncate" style={{ letterSpacing: '-0.01em' }}>
          {title}
        </h1>
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </header>
  );
}

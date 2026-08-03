import { NavLink } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="px-4 py-10">
      <h1 className="text-[24px]">Not on any page</h1>
      <p className="text-[14px] text-muted mt-2">That is not a page in the notebook.</p>
      <div className="mt-6">
        <NavLink to="/" className="mono uppercase text-[13px] px-3"
          style={{ minHeight: 'var(--tap-min)', border: '1px solid var(--color-ink)', borderRadius: 'var(--radius-tap)', display: 'inline-flex', alignItems: 'center' }}>
          Back to the till
        </NavLink>
      </div>
    </main>
  );
}

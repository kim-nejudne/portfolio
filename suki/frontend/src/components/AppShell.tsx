import { Outlet, NavLink } from 'react-router-dom';
import { SyncIndicator } from './SyncIndicator';

export function AppShell() {
  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100dvh', paddingBottom: 'var(--bottom-bar-height)' }}
    >
      <a href="#main" className="skip-link">Skip to content</a>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <nav
        aria-label="Primary"
        className="fixed left-0 right-0 bottom-0 z-40"
        style={{ height: 'var(--bottom-bar-height)', background: 'var(--color-paper)', borderTop: '1px solid var(--color-rule)' }}
      >
        <ul className="grid grid-cols-5 h-full">
          <TabItem to="/till" label="Till" />
          <TabItem to="/lista" label="Lista" />
          <TabItem to="/stock" label="Stock" />
          <TabItem to="/day" label="Day" />
          <li className="contents">
            <SyncIndicator />
          </li>
        </ul>
      </nav>
    </div>
  );
}

function TabItem({ to, label }: { to: string; label: string }) {
  return (
    <li className="contents">
      {/* No `end`: prefix matching is what keeps Lista lit on a customer's
          page. It used to be forced on for the Till because the Till was `/`
          and would otherwise have matched every route in the app; now that it
          is `/till` there is no path left that needs the exception. `/cart`
          still matches no tab, which is deliberate — the cart is somewhere you
          are sent mid-sale, not a place in the shop. */}
      <NavLink
        to={to}
        className={({ isActive }) =>
          [
            'flex flex-col items-center justify-center text-[13px] tracking-wide',
            'transition-colors',
            isActive ? 'text-ink' : 'text-muted',
          ].join(' ')
        }
        style={{ minHeight: 'var(--tap-min)' }}
      >
        {({ isActive }) => (
          <>
            <span
              aria-hidden
              className="block mb-1"
              style={{
                width: 20,
                height: 2,
                background: isActive ? 'var(--color-ink)' : 'transparent',
              }}
            />
            <span className="uppercase">{label}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}

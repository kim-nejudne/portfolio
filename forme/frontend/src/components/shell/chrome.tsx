import Link from 'next/link';
import { chooseRoleAction, signOutAction } from '@/lib/actions/session';
import { ROLE_LABEL } from '@/lib/api/session';
import type { Role, Session } from '@forme/domain';

export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:border focus:border-ink focus:bg-paper focus:px-3 focus:py-2 focus:label-caps"
    >
      Skip to content
    </a>
  );
}

export function Wordmark({ onInk = false }: { onInk?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="num text-md font-semibold tracking-[0.22em]">FORME</span>
      <span className={`label-caps ${onInk ? 'text-muted-ink' : 'text-muted'}`}>Manila</span>
    </span>
  );
}

export interface NavItem {
  href: string;
  label: string;
}

export function SurfaceHeader({
  surface,
  strap,
  nav,
  session,
  home = '/',
}: {
  surface: string;
  strap: string;
  nav: readonly NavItem[];
  session: Session | null;
  home?: string;
}) {
  return (
    <header className="border-b-2 border-rule-strong">
      <div className="mx-auto flex h-12 max-w-[90rem] items-center justify-between gap-6 px-4">
        <div className="flex items-baseline gap-4">
          <Link href={home} className="shrink-0" data-testid="header-home">
            <Wordmark />
          </Link>
          <span aria-hidden="true" className="h-4 w-px bg-rule-strong" />
          <span className="label-caps">{surface}</span>
          <span className="label-caps hidden text-muted md:inline">{strap}</span>
        </div>
        <nav aria-label={`${surface} navigation`} className="flex items-center gap-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              className="label-caps text-muted transition-colors duration-100 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
          {session ? <RoleStrip session={session} /> : null}
        </nav>
      </div>
    </header>
  );
}

function RoleStrip({ session }: { session: Session }) {
  return (
    <span className="flex items-center gap-3 border-l border-rule-strong pl-4">
      <span className="label-caps" data-testid="session-role">
        {ROLE_LABEL[session.role]}
      </span>
      <span className="label-caps hidden text-muted lg:inline">{session.operator}</span>
      <form action={signOutAction}>
        <button
          type="submit"
          data-testid="sign-out"
          className="label-caps text-muted transition-colors duration-100 hover:text-magenta"
        >
          Sign out
        </button>
      </form>
    </span>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t-2 border-rule-strong">
      <div className="mx-auto grid max-w-[72rem] gap-6 px-4 py-8 md:grid-cols-4">
        <div>
          <Wordmark />
          <p className="mt-2 text-xs text-muted">
            Trade printer. Litho and digital. We print for studios, publishers and agencies.
          </p>
        </div>
        <dl className="num text-xs">
          <dt className="label-caps text-muted">Hours</dt>
          <dd>07:00–19:00, six days</dd>
          <dt className="label-caps mt-2 text-muted">Shifts</dt>
          <dd>2</dd>
        </dl>
        <dl className="num text-xs">
          <dt className="label-caps text-muted">Standard</dt>
          <dd>5 working days from proof approval</dd>
          <dt className="label-caps mt-2 text-muted">Rush</dt>
          <dd>24 hours at 1.800×</dd>
        </dl>
        <ul className="label-caps space-y-1">
          <li>
            <Link className="border-b border-ink pb-0.5" href="/specs">
              Artwork specification
            </Link>
          </li>
          <li>
            <Link className="border-b border-ink pb-0.5" href="/quote">
              Instant quote
            </Link>
          </li>
          <li>
            <Link className="border-b border-ink pb-0.5" href="/sign-in">
              Sign in
            </Link>
          </li>
        </ul>
      </div>

      {/*
        The way back to the portfolio, and the only place that says what FORME
        is. The shop presents as a real Manila trade printer down to its press
        list and its turnaround, which is the right register for the work — but
        the hub links out to every spoke and until 2026-08-06 nothing linked
        back, so a shared forme.kimnejudne.dev link was a dead end rather than a
        door.
      */}
      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-[72rem] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-4 text-xs text-muted">
          <span className="label-caps">Demo &middot; a portfolio piece</span>
          <a className="border-b border-rule-strong pb-0.5" href="https://kimnejudne.dev/work/forme/">
            Case study
          </a>
          <a className="border-b border-rule-strong pb-0.5" href="https://kimnejudne.dev/">
            More work by Kim Nejudne
          </a>
        </div>
      </div>
    </footer>
  );
}

export function GateNotice({
  surface,
  required,
  current,
  explanation,
}: {
  surface: string;
  required: Role;
  current: Role;
  explanation: string;
}) {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-16">
      <p className="label-caps text-magenta">Not your surface</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{surface} is role gated</h1>
      <p className="mt-3 text-muted">{explanation}</p>
      <dl className="mt-6 grid grid-cols-2 gap-px border border-rule-strong bg-rule-strong">
        <div className="bg-paper px-3 py-2">
          <dt className="label-caps text-muted">Signed in as</dt>
          <dd className="num text-sm uppercase">{ROLE_LABEL[current]}</dd>
        </div>
        <div className="bg-paper px-3 py-2">
          <dt className="label-caps text-muted">Required</dt>
          <dd className="num text-sm uppercase">{ROLE_LABEL[required]}</dd>
        </div>
      </dl>
      <form action={chooseRoleAction} className="mt-6 flex items-center gap-4">
        <input type="hidden" name="role" value={required} />
        <button
          type="submit"
          data-testid="gate-switch-role"
          className="border border-ink px-4 py-2 label-caps transition-colors duration-100 hover:bg-ink hover:text-paper"
        >
          Switch to {ROLE_LABEL[required]}
        </button>
        <Link href="/sign-in" className="label-caps border-b border-ink pb-0.5">
          Sign-in screen
        </Link>
      </form>
    </main>
  );
}

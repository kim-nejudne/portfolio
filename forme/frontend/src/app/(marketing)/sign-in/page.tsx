import type { Metadata } from 'next';
import Link from 'next/link';
import { RegistrationTarget } from '@/components/furniture/marks';
import { chooseRoleAction } from '@/lib/actions/session';
import { ROLE_LABEL, getSession } from '@/lib/api/session';
import type { Role } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to the FORME production system.',
  robots: { index: false, follow: false },
};

const ROLE_NOTES: Record<Role, string> = {
  customer: 'Job list, proofs and job submission for Nine Dots Studio.',
  prepress: 'The queue across every customer, preflight overrides and the imposition planner.',
  floor: 'The press floor board. Three presses, read from six metres.',
  admin: 'The price matrix that drives the quote calculator.',
};

const ROLES: readonly Role[] = ['customer', 'prepress', 'floor', 'admin'];

export default async function SignInPage() {
  const session = await getSession();

  return (
    <main id="main" className="mx-auto max-w-[34rem] px-4 py-14">
      <div className="flex items-baseline justify-between">
        <p className="label-caps text-muted">Production system</p>
        <RegistrationTarget size={16} />
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-3 text-muted">
        Trade accounts only. If you do not have one, send a specification and we will open one.
      </p>

      <form className="mt-8 border border-rule-strong p-4" data-testid="sign-in-form">
        <p>
          <label htmlFor="email" className="label-caps text-muted">
            Account email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="studio@example.ph"
            className="mt-1 h-9 w-full border border-rule-strong bg-paper px-2 num text-sm focus:border-ink"
          />
        </p>
        <p className="mt-4">
          <label htmlFor="password" className="label-caps text-muted">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="mt-1 h-9 w-full border border-rule-strong bg-paper px-2 num text-sm focus:border-ink"
          />
        </p>
        <button
          type="submit"
          disabled
          aria-describedby="auth-note"
          className="mt-5 w-full border border-rule-strong px-4 py-2 label-caps text-muted"
          data-testid="sign-in-submit"
        >
          Sign in
        </button>
        <p id="auth-note" className="mt-2 text-xs text-muted">
          Authentication is not wired up in this build. The form is here so the layout is right
          when it is. Use the role picker below.
        </p>
      </form>

      <section aria-labelledby="demo" className="mt-10 border-2 border-ink">
        <div className="flex items-baseline justify-between border-b-2 border-ink px-4 py-2">
          <h2 id="demo" className="label-caps">
            Demo control — role picker
          </h2>
          <span className="num text-2xs text-muted" data-testid="current-role">
            {session.signedIn ? ROLE_LABEL[session.role].toUpperCase() : 'NOT SIGNED IN'}
          </span>
        </div>
        <p className="px-4 py-3 text-xs text-muted">
          This is scaffolding, not authentication. Choosing a role sets a cookie and lands on that
          role&apos;s home screen. The whole mechanism lives in one module and the layouts read it
          server-side.
        </p>
        <ul className="divide-y divide-rule border-t border-rule">
          {ROLES.map((role) => (
            <li key={role} className="flex items-center justify-between gap-4 px-4 py-3">
              <span>
                <span className="num text-sm uppercase">{ROLE_LABEL[role]}</span>
                <span className="mt-0.5 block text-xs text-muted">{ROLE_NOTES[role]}</span>
              </span>
              <form action={chooseRoleAction}>
                <input type="hidden" name="role" value={role} />
                <button
                  type="submit"
                  data-testid={`role-${role}`}
                  className="border border-ink px-3 py-1.5 label-caps transition-colors duration-100 hover:bg-ink hover:text-paper"
                >
                  Enter
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-xs text-muted">
        Not a customer yet?{' '}
        <Link className="border-b border-ink pb-0.5 text-ink" href="/specs">
          Read the artwork specification
        </Link>{' '}
        or{' '}
        <Link className="border-b border-ink pb-0.5 text-ink" href="/quote">
          price a job
        </Link>
        .
      </p>
    </main>
  );
}

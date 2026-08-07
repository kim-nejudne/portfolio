import type { Metadata } from 'next';
import Link from 'next/link';
import { RegistrationTarget } from '@/components/furniture/marks';
import { chooseRoleAction, signInAction } from '@/lib/actions/session';
import { ROLE_LABEL, getSession } from '@/lib/api/session';
import type { Role } from '@forme/domain';

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

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, query] = await Promise.all([getSession(), searchParams]);

  // Set by the middleware when it turned someone away from a gated surface.
  // Carried through the form so signing in returns them to where they were
  // going; the action validates it again before redirecting.
  const next = typeof query.next === 'string' ? query.next : '';
  const error = typeof query.error === 'string' ? query.error : '';

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

      {next ? (
        <p
          className="mt-4 border-l-2 border-magenta px-3 py-2 text-sm text-muted"
          data-testid="sign-in-redirect-notice"
        >
          That page needs an account. Sign in and we will take you straight there.
        </p>
      ) : null}

      <form
        action={signInAction}
        className="mt-8 border border-rule-strong p-4"
        data-testid="sign-in-form"
      >
        <input type="hidden" name="next" value={next} />
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
        {error ? (
          <p
            role="alert"
            className="mt-4 border-l-2 border-magenta px-3 py-2 text-sm"
            data-testid="sign-in-error"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          aria-describedby="auth-note"
          className="mt-5 w-full border border-ink bg-ink px-4 py-2 label-caps text-paper transition-colors duration-100 hover:bg-paper hover:text-ink"
          data-testid="sign-in-submit"
        >
          Sign in
        </button>
        <p id="auth-note" className="mt-2 text-xs text-muted">
          Sessions last eight hours and are signed. Sign-in is rate limited to ten attempts per
          ten minutes.
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
          Each of these signs in as a real, read-only account for that role &mdash; the same
          endpoint as the form above, not a shortcut past it. They can read every screen and
          change nothing, so the next visitor sees the shop as it was.
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
                <input type="hidden" name="next" value={next} />
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

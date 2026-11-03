import { Suspense, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Outlet, useMatch } from 'react-router';
import { AdminCategories } from '../components/AdminCategories.js';
import { OverflowMenu } from '../components/OverflowMenu.js';
import { PageShell } from '../components/PageShell.js';
import { categoryRoute } from '../lib/adminCategories.js';
import { adminSignIn, adminSignOut, useAdminSession } from '../lib/adminSession.js';
import { useDesktopLayout, useMediaQuery } from '../lib/useMediaQuery.js';
import {
  BUTTON_ICON,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  CARD,
  INPUT,
  LABEL,
  LINK,
} from '../lib/ui.js';

/** Tailwind's `sm` (640px): from here the header's links and Logout sit in the bar, not a menu. */
export const HEADER_ROW_QUERY = '(min-width: 40rem)';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The time a session ends, in the browser's locale: "21:30" or "9:30 PM". */
export function clockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function SignInForm() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = password !== '' && !busy;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    // On success the session state changes and this form unmounts.
    adminSignIn(password).catch((err: unknown) => {
      setBusy(false);
      setPassword('');
      setError(message(err));
    });
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby="admin-heading"
      className={`flex flex-col gap-4 ${CARD}`}
    >
      <h1 id="admin-heading" className="font-display text-3xl">
        Admin
      </h1>
      <label htmlFor="admin-password" className={LABEL}>
        Password
      </label>
      <input
        id="admin-password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        enterKeyHint="go"
        aria-invalid={error !== null}
        aria-describedby={error ? 'admin-error' : undefined}
        className={INPUT}
      />
      {error && (
        <p id="admin-error" role="alert" className="text-lg text-buzz">
          {error}
        </p>
      )}
      <button type="submit" disabled={!ready} className={`${BUTTON_PRIMARY} text-2xl`}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

/**
 * The admin bar on every wrapped page (ADM-06): **Buzzr Admin** home, then Question sets, the
 * session's end and Logout, which fold into a ⋯ menu below `sm`. History arrives with F128.
 */
function AdminHeader({ expiresAt }: { expiresAt: number }) {
  const inRow = useMediaQuery(HEADER_ROW_QUERY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const until = clockTime(expiresAt);

  function signOut() {
    setBusy(true);
    setError(null);
    // On success the session state changes and the layout shows the sign-in form.
    adminSignOut().catch((err: unknown) => {
      setBusy(false);
      setError(message(err));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center gap-x-6 gap-y-2">
        <Link to="/admin" className="mr-auto font-display text-2xl text-accent hover:text-ink">
          Buzzr Admin
        </Link>
        {inRow ? (
          <>
            <Link to="/sets" className={`${LINK} text-lg`}>
              Question sets
            </Link>
            <p className="text-muted">
              Signed in until <strong className="text-ink">{until}</strong>
            </p>
            <button type="button" onClick={signOut} disabled={busy} className={BUTTON_SECONDARY}>
              {busy ? 'Logging out…' : 'Logout'}
            </button>
          </>
        ) : (
          <OverflowMenu
            label="Admin menu"
            trigger="⋯"
            triggerClassName={`${BUTTON_ICON} text-xl`}
            disabled={busy}
            items={[
              { label: 'Question sets', to: '/sets' },
              // The session's end rides on Logout: a menu item that does nothing would read as broken.
              { label: busy ? 'Logging out…' : `Logout (until ${until})`, onSelect: signOut },
            ]}
          />
        )}
      </header>
      {error && (
        <p role="alert" className="text-lg text-buzz">
          {error}
        </p>
      )}
    </div>
  );
}

/** The phone's way back from an inner page: to the category from a level, else to the list. */
function BackLink() {
  const level = useMatch('/admin/categories/:name/:setId');
  const index = useMatch('/admin');
  if (index) return null;
  const name = level?.params.name;
  return name ? (
    <Link to={categoryRoute(name)} className={`${LINK} self-start text-lg`}>
      ← {name}
    </Link>
  ) : (
    <Link to="/admin" className={`${LINK} self-start text-lg`}>
      ← Categories
    </Link>
  );
}

/** The signed-in frame: two panes from `lg`, one below it (ADM-02). */
function AdminFrame({ expiresAt }: { expiresAt: number }) {
  const desktop = useDesktopLayout();
  const page = (
    <Suspense>
      <Outlet />
    </Suspense>
  );

  if (desktop) {
    return (
      <div data-layout="panes" className="flex h-dvh flex-col">
        <div className="border-b-2 border-edge px-8 py-3">
          <AdminHeader expiresAt={expiresAt} />
        </div>
        <div className="flex min-h-0 flex-1">
          <aside
            aria-label="Categories"
            className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r-2 border-edge p-4 xl:w-90"
          >
            <AdminCategories />
          </aside>
          <main className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-8">{page}</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div
      data-layout="single"
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-6 short:py-3 md:px-8 md:py-10"
    >
      <AdminHeader expiresAt={expiresAt} />
      <BackLink />
      <main className="flex flex-col gap-6">{page}</main>
    </div>
  );
}

/** The frame of a page that is not signed in: the form or a state, narrow, with a way home. */
function Gate({ children }: { children: ReactNode }) {
  return (
    <PageShell width="narrow">
      {children}
      <Link to="/" className={`${LINK} self-center text-lg`}>
        Back to start
      </Link>
    </PageShell>
  );
}

/**
 * The frame of `/admin` and its pages (F119): the session gate once, then the admin header and,
 * from `lg`, the category list beside the open page. The built-in editor (`/admin/sets/:setId`)
 * keeps its own frame. Nothing in the app links here; the admin types the URL.
 */
export function AdminLayout() {
  const session = useAdminSession();
  const index = useMatch('/admin');

  switch (session.kind) {
    case 'loading':
      return (
        <Gate>
          <p className="text-lg text-muted">Checking…</p>
        </Gate>
      );
    case 'disabled':
      return (
        <Gate>
          <h1 className="font-display text-3xl">Admin</h1>
          <p className="text-lg text-muted">Admin sign-in is not set up on this server.</p>
        </Gate>
      );
    case 'failed':
      return (
        <Gate>
          <h1 className="font-display text-3xl">Admin</h1>
          <p role="alert" className="text-lg text-buzz">
            Could not reach the server.
          </p>
          <button type="button" onClick={session.retry} className={BUTTON_SECONDARY}>
            Retry
          </button>
        </Gate>
      );
    case 'signedOut':
      // Signing in here opens the page that was asked for: the URL stays.
      return (
        <Gate>
          {!index && <p className="text-lg">Only the admin can open this page. Sign in first.</p>}
          <SignInForm />
        </Gate>
      );
    case 'signedIn':
      return <AdminFrame expiresAt={session.expiresAt} />;
  }
}

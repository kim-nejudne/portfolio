import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useMatch, useSearchParams } from 'react-router';
import { AdminCategories, AdminOverview } from '../components/AdminCategories.js';
import { AdminCategory } from './AdminCategory.js';
import { AdminLevel } from './AdminLevel.js';
import { filterSearch, parseFilter } from '../lib/adminCategories.js';
import {
  ADMIN_NOT_CONFIGURED,
  adminSignIn,
  adminSignOut,
  useAdminSession,
} from '../lib/adminSession.js';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT, LINK, message } from '../lib/adminUi.js';
import { useDesktopLayout } from '../lib/useMediaQuery.js';

/** The time a session ends, in the browser's locale: "21:30" or "9:30 PM". */
export function clockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function Gate({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-8">
      {children}
    </main>
  );
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
    <form onSubmit={submit} aria-labelledby="admin-heading" className={CARD}>
      <h1 id="admin-heading" className="text-2xl font-bold">
        Pinpoint Admin
      </h1>
      <label htmlFor="admin-password" className="font-semibold text-text-dim">
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
        <p id="admin-error" role="alert" className="text-delayed">
          {error}
        </p>
      )}
      <button type="submit" disabled={!ready} className={BUTTON_PRIMARY}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

/**
 * The bar on every signed-in page: **Pinpoint Admin** (home), History, the session's end and
 * Logout; below 1024 px the last three fold into a ⋯ menu, the session's end riding on Logout.
 */
function AdminHeader({ expiresAt, desktop }: { expiresAt: number; desktop: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const until = clockTime(expiresAt);
  const close = () => menu.current?.removeAttribute('open');

  // The ⋯ menu closes on a tap outside it, as menus do.
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  function signOut() {
    // The menu stays open on "Logging out…"; signed out, the whole frame goes.
    setBusy(true);
    setError(null);
    // On success the session state changes and the gate shows the sign-in form.
    adminSignOut().catch((err: unknown) => {
      setBusy(false);
      setError(message(err));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center gap-x-6 gap-y-2">
        <Link to="/admin" className="mr-auto text-2xl font-bold text-amber">
          Pinpoint Admin
        </Link>
        {desktop ? (
          <>
            {/* NavLink marks it aria-current="page" on /admin/history. */}
            <NavLink to="/admin/history" className={LINK}>
              History
            </NavLink>
            <p className="text-text-dim">
              Signed in until <strong className="board-face text-text">{until}</strong>
            </p>
            <button type="button" onClick={signOut} disabled={busy} className={BUTTON_SECONDARY}>
              {busy ? 'Logging out…' : 'Logout'}
            </button>
          </>
        ) : (
          <details
            ref={menu}
            className="relative"
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || !menu.current?.open) return;
              close();
              menu.current.querySelector('summary')?.focus();
            }}
          >
            <summary
              aria-label="Admin menu"
              className={`${BUTTON_SECONDARY} w-12 cursor-pointer list-none px-0 text-xl [&::-webkit-details-marker]:hidden`}
            >
              ⋯
            </summary>
            <div className="absolute right-0 z-10 mt-2 flex w-64 flex-col rounded-card border border-line bg-board-panel p-2">
              <Link to="/admin/history" onClick={close} className={`${LINK} px-3`}>
                History
              </Link>
              <button
                type="button"
                onClick={signOut}
                disabled={busy}
                className={`${LINK} px-3 text-left`}
              >
                {busy ? 'Logging out…' : `Logout (until ${until})`}
              </button>
            </div>
          </details>
        )}
      </header>
      {error && (
        <p role="alert" className="text-delayed">
          {error}
        </p>
      )}
    </div>
  );
}

/** Pages a later feature builds (F43, F45). */
function NotBuiltYet({ title }: { title: string }) {
  return (
    <section aria-labelledby="page-heading" className="flex flex-col gap-2">
      <h1 id="page-heading" className="text-3xl font-bold">
        {title}
      </h1>
      <p className="text-text-dim">This page is not built yet.</p>
    </section>
  );
}

/** `/admin` itself: the overview beside the list pane, or the list alone on a narrow screen. */
function AdminHome({ desktop }: { desktop: boolean }) {
  if (desktop) return <AdminOverview />;
  return (
    <>
      <h1 className="sr-only">Pinpoint Admin</h1>
      <AdminCategories showCounts />
    </>
  );
}

/**
 * What the category page just did ("Japan is live: 3 levels published."), passed in the
 * navigation's state. The region stays mounted across admin pages, so its new text is announced.
 */
function Notice() {
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  return (
    <div role="status" className="empty:hidden">
      {notice && (
        <p className="rounded-card border border-amber px-4 py-3 font-semibold">{notice}</p>
      )}
    </div>
  );
}

/** The narrow layout's way back from an inner page to the list, keeping its filter and search. */
function BackLink() {
  const index = useMatch('/admin');
  const [params] = useSearchParams();
  if (index) return null;
  return (
    <Link
      to={`/admin${filterSearch(parseFilter(params.get('filter')), params.get('q') ?? '')}`}
      className={`${LINK} self-start`}
    >
      ← Categories
    </Link>
  );
}

function AdminPages({ desktop }: { desktop: boolean }) {
  return (
    <>
      <Notice />
      <Routes>
        <Route index element={<AdminHome desktop={desktop} />} />
        <Route path="categories/:id" element={<AdminCategory />} />
        <Route path="categories/:id/:level" element={<AdminLevel />} />
        <Route path="generate" element={<NotBuiltYet title="Add category" />} />
        <Route path="history" element={<NotBuiltYet title="History" />} />
        <Route path="*" element={<NotBuiltYet title="No such admin page" />} />
      </Routes>
    </>
  );
}

/** The signed-in frame: the list pane beside the open page from 1024 px, one pane below it. */
function AdminFrame({ expiresAt }: { expiresAt: number }) {
  const desktop = useDesktopLayout();

  if (desktop) {
    // Each scroll pane is `relative`, so an sr-only span inside it can't stretch the document.
    return (
      <div data-layout="panes" className="flex h-dvh flex-col">
        <div className="border-b border-line px-8 py-3">
          <AdminHeader expiresAt={expiresAt} desktop />
        </div>
        <div className="flex min-h-0 flex-1">
          <aside
            aria-label="Categories"
            className="relative flex w-96 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line p-4"
          >
            <AdminCategories />
          </aside>
          <main className="relative min-w-0 flex-1 overflow-y-auto">
            <div className="flex max-w-3xl flex-col gap-6 px-8 py-8">
              <AdminPages desktop />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div
      data-layout="single"
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 px-4 py-4"
    >
      <AdminHeader expiresAt={expiresAt} desktop={false} />
      <BackLink />
      <main className="flex flex-col gap-4">
        <AdminPages desktop={false} />
      </main>
    </div>
  );
}

/**
 * `/admin` and below: the session gate (sign-in, not configured, unreachable), then the admin
 * frame. Nothing in the app links here; the admin types the URL. Signing in on an inner page
 * keeps its URL, so the page asked for opens.
 */
export function Admin() {
  const session = useAdminSession();
  switch (session.kind) {
    case 'loading':
      return (
        <Gate>
          <p role="status" className="text-text-dim">
            Checking…
          </p>
        </Gate>
      );
    case 'disabled':
      return (
        <Gate>
          <h1 className="text-2xl font-bold">Pinpoint Admin</h1>
          <p className="text-text-dim">{ADMIN_NOT_CONFIGURED}</p>
        </Gate>
      );
    case 'failed':
      return (
        <Gate>
          <h1 className="text-2xl font-bold">Pinpoint Admin</h1>
          <p role="alert" className="text-delayed">
            Could not reach the server.
          </p>
          <button type="button" onClick={session.retry} className={BUTTON_SECONDARY}>
            Retry
          </button>
        </Gate>
      );
    case 'signedOut':
      return (
        <Gate>
          <SignInForm />
        </Gate>
      );
    case 'signedIn':
      return <AdminFrame expiresAt={session.expiresAt} />;
  }
}

import { useState, type FormEvent, type ReactNode } from 'react';
import {
  ADMIN_NOT_CONFIGURED,
  adminSignIn,
  adminSignOut,
  useAdminSession,
} from '../lib/adminSession.js';

const CARD = 'flex flex-col gap-4 rounded-card border border-line bg-board-panel p-6';
const BUTTON_PRIMARY =
  'min-h-12 rounded-button bg-amber px-6 text-lg font-semibold text-board-bg [@media(hover:hover)]:hover:brightness-110 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100';
const BUTTON_SECONDARY =
  'min-h-12 rounded-button border border-line px-6 text-lg font-semibold text-text [@media(hover:hover)]:hover:bg-board-bg';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

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
        className="h-12 w-full min-w-0 rounded-button border border-line bg-board-panel px-4 text-lg text-text"
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

function SignedIn({ expiresAt }: { expiresAt: number }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <section aria-labelledby="admin-heading" className={CARD}>
      <h1 id="admin-heading" className="text-2xl font-bold">
        Pinpoint Admin
      </h1>
      <p className="text-text-dim">
        Signed in until <span className="board-face">{clockTime(expiresAt)}</span>.
      </p>
      {error && (
        <p role="alert" className="text-delayed">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => adminSignOut().catch((err: unknown) => setError(message(err)))}
        className={BUTTON_SECONDARY}
      >
        Logout
      </button>
    </section>
  );
}

/**
 * `/admin` and below: the session gate (sign-in, not configured, unreachable). Nothing in the app
 * links here; the admin types the URL. F31 replaces the signed-in card with the admin layout.
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
      return (
        <Gate>
          <SignedIn expiresAt={session.expiresAt} />
        </Gate>
      );
  }
}

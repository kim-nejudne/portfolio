import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { PageShell } from '../components/PageShell.js';
import { adminSignIn, adminSignOut, useAdminSession } from '../lib/adminSession.js';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT, LABEL, LINK } from '../lib/ui.js';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The time a session ends, in the browser's locale: "21:30" or "9:30 PM". */
function clockTime(epochMs: number): string {
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

function SignedIn({ expiresAt }: { expiresAt: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function signOut() {
    setBusy(true);
    setError(null);
    adminSignOut().catch((err: unknown) => {
      setBusy(false);
      setError(message(err));
    });
  }

  return (
    <section aria-labelledby="admin-heading" className={`flex flex-col gap-4 ${CARD}`}>
      <h1 id="admin-heading" className="font-display text-3xl">
        Admin
      </h1>
      <p className="text-lg text-muted">
        Signed in until <strong className="text-ink">{clockTime(expiresAt)}</strong>.
      </p>
      <Link to="/sets" className={`${BUTTON_PRIMARY} text-center text-2xl`}>
        Question sets
      </Link>
      {error && (
        <p role="alert" className="text-lg text-buzz">
          {error}
        </p>
      )}
      <button type="button" onClick={signOut} disabled={busy} className={BUTTON_SECONDARY}>
        {busy ? 'Logging out…' : 'Logout'}
      </button>
    </section>
  );
}

/**
 * `/admin`: the super-admin's sign-in (F105). Nothing in the app links here; the admin types the URL.
 */
export function Admin() {
  const session = useAdminSession();

  let body;
  switch (session.kind) {
    case 'loading':
      body = <p className="text-lg text-muted">Checking…</p>;
      break;
    case 'disabled':
      body = (
        <>
          <h1 className="font-display text-3xl">Admin</h1>
          <p className="text-lg text-muted">Admin sign-in is not set up on this server.</p>
        </>
      );
      break;
    case 'failed':
      body = (
        <>
          <h1 className="font-display text-3xl">Admin</h1>
          <p role="alert" className="text-lg text-buzz">
            Could not reach the server.
          </p>
          <button type="button" onClick={session.retry} className={BUTTON_SECONDARY}>
            Retry
          </button>
        </>
      );
      break;
    case 'signedOut':
      body = <SignInForm />;
      break;
    case 'signedIn':
      body = <SignedIn expiresAt={session.expiresAt} />;
      break;
  }

  return (
    <PageShell width="narrow">
      {body}
      <Link to="/" className={`${LINK} self-center text-lg`}>
        Back to start
      </Link>
    </PageShell>
  );
}

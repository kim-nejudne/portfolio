// `/admin` (F80, Admin access): setup, sign-in, "Forgot password" and the signed-in shell, in the
// sketchbook look. A lazy route: nothing here is imported by `/` or `/play`, so its strings live
// here rather than in copy.ts (which is in the player bundle). Desktop-first, one column at 375 px.
// F81 fills the shell with the category editor.

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from 'react';
import { ADMIN_PASSWORD_MIN } from '../../../../shared/constants.js';
import type { AdminStatusResponse } from '../../../../shared/types.js';
import { SketchButton } from '../../components/sketch/SketchButton.js';
import { Tape } from '../../components/sketch/Tape.js';
import { adminLogin, adminLogout, adminReset, adminSetup, adminStatus } from './adminApi.js';

export type AdminView =
  'loading' | 'unreachable' | 'notConfigured' | 'setup' | 'login' | 'reset' | 'shell';

/** Which screen `/admin` shows for a status (null while loading, 'error' when unreachable). */
export function adminView(
  status: AdminStatusResponse | null | 'error',
  forgot: boolean,
): AdminView {
  if (status === null) return 'loading';
  if (status === 'error') return 'unreachable';
  if (!status.configured) return 'notConfigured';
  if (!status.passwordSet) return 'setup';
  if (status.signedIn) return 'shell';
  return forgot ? 'reset' : 'login';
}

export const ADMIN_COPY = {
  title: 'Sketchy admin',
  loading: 'Loading…',
  unreachable: 'Could not reach the server.',
  retry: 'Try again',
  notConfigured: 'Admin not configured',
  notConfiguredHelp:
    'Set SKETCHY_ADMIN_SETUP_CODE in the server’s environment and restart it to set a password.',
  setupHeading: 'Set the admin password',
  setupHelp: 'Enter the setup code from the server’s environment and choose a password.',
  resetHeading: 'Forgot password',
  resetHelp:
    'Enter the setup code from the server’s environment and choose a new password. Everyone signed in is signed out.',
  loginHeading: 'Sign in',
  setupCode: 'Setup code',
  password: 'Password',
  newPassword: 'New password',
  passwordHint: `At least ${ADMIN_PASSWORD_MIN} characters.`,
  save: 'Save and sign in',
  saving: 'Saving…',
  signIn: 'Sign in',
  signingIn: 'Signing in…',
  forgot: 'Forgot password?',
  back: 'Back to sign in',
  signOut: 'Sign out',
  shellHeading: 'Word categories',
  shellBody: 'You’re signed in. The category editor will appear here.',
} as const;

const INPUT =
  'sketch-border min-h-12 w-full min-w-0 bg-paper px-4 text-[22px] text-ink outline-none placeholder:text-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen';
const LINK_BUTTON =
  'min-h-11 self-start text-lg text-pen underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** A refusal under a form, in `ink` after a red-pen ✗, as on the landing page. */
function ErrorLine({ id, text }: { id: string; text: string | null }) {
  return (
    <p id={id} role="alert" className="text-lg leading-snug text-ink">
      {text && (
        <>
          <span aria-hidden className="text-red">
            ✗{' '}
          </span>
          {text}
        </>
      )}
    </p>
  );
}

/** A taped paper card, like the landing page's. */
function Card({ children, labelledBy }: { children: ReactNode; labelledBy?: string }) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="relative grid gap-3 rounded-[3px] border-[2.5px] border-ink bg-paper px-5 pt-6 pb-5 shadow-[4px_5px_0_var(--color-ink)]"
    >
      <Tape place="top" />
      {children}
    </section>
  );
}

/**
 * A labelled input. `errorId` names the form's error line, read with the field; `error` marks it
 * invalid.
 */
function Field({
  label,
  hint,
  errorId,
  error = false,
  ...input
}: {
  label: string;
  hint?: string;
  errorId?: string;
  error?: boolean;
} & ComponentProps<'input'>) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : '', errorId ?? ''].filter(Boolean).join(' ');
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-[22px] leading-tight">
        {label}
      </label>
      <input
        id={id}
        className={INPUT}
        aria-describedby={describedBy || undefined}
        aria-invalid={error || undefined}
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-base leading-snug text-soft">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * The account name password managers need beside a password to save and fill it. There is one
 * admin, so it is fixed, kept out of sight and out of the tab order (`sr-only`, not hidden:
 * some managers skip hidden fields).
 */
function UsernameForManagers() {
  return (
    <input
      type="text"
      name="username"
      autoComplete="username"
      value="admin"
      readOnly
      tabIndex={-1}
      aria-hidden
      className="sr-only"
    />
  );
}

/**
 * Setup (first visit) and "Forgot password": the setup code and a new password. Both sign this
 * browser in when the server accepts them.
 */
export function NewPasswordForm({
  mode,
  onDone,
  onBack,
}: {
  mode: 'setup' | 'reset';
  onDone: () => void;
  onBack?: () => void;
}) {
  const [setupCode, setSetupCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = setupCode.trim() !== '' && password.length >= ADMIN_PASSWORD_MIN && !busy;
  const errorId = `admin-${mode}-error`;
  const headingId = `admin-${mode}-heading`;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    (mode === 'setup' ? adminSetup : adminReset)({ setupCode, password })
      .then(onDone)
      .catch((err: unknown) => {
        setBusy(false);
        setError(message(err));
      });
  }

  return (
    <Card labelledBy={headingId}>
      <form onSubmit={submit} className="grid gap-4">
        <h2 id={headingId} className="text-[32px] leading-tight font-normal">
          {mode === 'setup' ? ADMIN_COPY.setupHeading : ADMIN_COPY.resetHeading}
        </h2>
        <p className="text-lg leading-snug text-soft">
          {mode === 'setup' ? ADMIN_COPY.setupHelp : ADMIN_COPY.resetHelp}
        </p>
        <UsernameForManagers />
        <Field
          label={ADMIN_COPY.setupCode}
          type="password"
          name="setupCode"
          // Not a saved password: keeps managers from pairing it with the new one.
          autoComplete="one-time-code"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          // The first field of a view that just replaced the button that opened it.
          autoFocus
          errorId={errorId}
          error={error !== null}
          value={setupCode}
          onChange={(event) => setSetupCode(event.target.value)}
        />
        <Field
          label={ADMIN_COPY.newPassword}
          hint={ADMIN_COPY.passwordHint}
          errorId={errorId}
          error={error !== null}
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={ADMIN_PASSWORD_MIN}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <ErrorLine id={errorId} text={error} />
        <SketchButton type="submit" full disabled={!ready}>
          {busy ? ADMIN_COPY.saving : ADMIN_COPY.save}
        </SketchButton>
        {onBack && (
          <button type="button" onClick={onBack} className={LINK_BUTTON}>
            {ADMIN_COPY.back}
          </button>
        )}
      </form>
    </Card>
  );
}

export function LoginForm({ onDone, onForgot }: { onDone: () => void; onForgot: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const ready = password !== '' && !busy;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    adminLogin({ password })
      .then(onDone)
      .catch((err: unknown) => {
        setBusy(false);
        setPassword('');
        setError(message(err));
        // Back in the field, so a phone keeps its keyboard for the next try.
        passwordRef.current?.focus();
      });
  }

  return (
    <Card labelledBy="admin-login-heading">
      <form onSubmit={submit} className="grid gap-4">
        <h2 id="admin-login-heading" className="text-[32px] leading-tight font-normal">
          {ADMIN_COPY.loginHeading}
        </h2>
        <UsernameForManagers />
        <Field
          ref={passwordRef}
          label={ADMIN_COPY.password}
          errorId="admin-login-error"
          error={error !== null}
          autoFocus
          type="password"
          name="password"
          autoComplete="current-password"
          enterKeyHint="go"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <ErrorLine id="admin-login-error" text={error} />
        <SketchButton type="submit" full disabled={!ready}>
          {busy ? ADMIN_COPY.signingIn : ADMIN_COPY.signIn}
        </SketchButton>
        <button type="button" onClick={onForgot} className={LINK_BUTTON}>
          {ADMIN_COPY.forgot}
        </button>
      </form>
    </Card>
  );
}

/** The signed-in admin: a bar with Sign out over the editor's place (F81). */
export function AdminShell({ onSignedOut }: { onSignedOut: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function signOut() {
    setBusy(true);
    setError(null);
    adminLogout()
      .then(onSignedOut)
      .catch((err: unknown) => {
        setBusy(false);
        setError(message(err));
      });
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-pen pb-3">
        <h1 className="text-[clamp(32px,6vw,48px)] leading-none font-normal">{ADMIN_COPY.title}</h1>
        <SketchButton variant="ghost" onClick={signOut} disabled={busy}>
          {ADMIN_COPY.signOut}
        </SketchButton>
      </header>
      <ErrorLine id="admin-shell-error" text={error} />
      <section aria-labelledby="admin-shell-heading" className="grid gap-2">
        <h2 id="admin-shell-heading" className="text-[28px] leading-tight font-normal">
          {ADMIN_COPY.shellHeading}
        </h2>
        <p className="text-lg leading-snug text-soft">{ADMIN_COPY.shellBody}</p>
      </section>
    </div>
  );
}

/** One view of `/admin`, given the handlers. Exported for markup tests. */
export function AdminBody({
  view,
  refresh,
  setForgot,
}: {
  view: AdminView;
  refresh: () => void;
  setForgot: (forgot: boolean) => void;
}) {
  switch (view) {
    case 'loading':
      return (
        <p role="status" className="text-xl text-soft">
          {ADMIN_COPY.loading}
        </p>
      );
    case 'unreachable':
      return (
        <Card>
          <p role="alert" className="text-xl leading-snug">
            {ADMIN_COPY.unreachable}
          </p>
          <SketchButton variant="ghost" onClick={refresh}>
            {ADMIN_COPY.retry}
          </SketchButton>
        </Card>
      );
    case 'notConfigured':
      return (
        <Card labelledBy="admin-off-heading">
          <h2 id="admin-off-heading" className="text-[32px] leading-tight font-normal">
            {ADMIN_COPY.notConfigured}
          </h2>
          <p className="text-lg leading-snug text-soft">{ADMIN_COPY.notConfiguredHelp}</p>
        </Card>
      );
    case 'setup':
      return <NewPasswordForm mode="setup" onDone={refresh} />;
    case 'reset':
      return (
        <NewPasswordForm
          mode="reset"
          // `forgot` stays set until sign-out, so the sign-in form doesn't flash before the shell.
          onDone={refresh}
          onBack={() => setForgot(false)}
        />
      );
    case 'login':
      return <LoginForm onDone={refresh} onForgot={() => setForgot(true)} />;
    case 'shell':
      return (
        <AdminShell
          onSignedOut={() => {
            setForgot(false);
            refresh();
          }}
        />
      );
  }
}

/** The page frame: dot paper, a wide column for the shell, a narrow one for the forms. */
export function AdminFrame({ view, children }: { view: AdminView; children: ReactNode }) {
  return (
    <main className="paper-dots min-h-dvh bg-paper pt-[max(24px,env(safe-area-inset-top))] pr-[max(18px,env(safe-area-inset-right))] pb-[max(24px,env(safe-area-inset-bottom))] pl-[max(18px,env(safe-area-inset-left))] font-hand text-ink">
      <div
        className={`mx-auto grid w-full ${view === 'shell' ? 'max-w-5xl gap-6' : 'max-w-md gap-8'}`}
      >
        {view !== 'shell' && (
          <h1 className="text-[clamp(40px,8vw,56px)] leading-none font-normal">
            {ADMIN_COPY.title}
          </h1>
        )}
        {children}
      </div>
    </main>
  );
}

export default function Admin() {
  const [status, setStatus] = useState<AdminStatusResponse | null | 'error'>(null);
  const [forgot, setForgot] = useState(false);

  const refresh = useCallback(() => {
    adminStatus()
      .then(setStatus)
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    const before = document.title;
    document.title = ADMIN_COPY.title;
    // Linked from nothing, but the path is guessable: keep it out of search results.
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.append(robots);
    refresh();
    return () => {
      document.title = before;
      robots.remove();
    };
  }, [refresh]);

  const view = adminView(status, forgot);
  return (
    <AdminFrame view={view}>
      <AdminBody view={view} refresh={refresh} setForgot={setForgot} />
    </AdminFrame>
  );
}

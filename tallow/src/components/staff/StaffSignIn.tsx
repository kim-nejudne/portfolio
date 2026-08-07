import React, { useEffect, useId, useState } from 'react';
import { Eye, Key } from 'lucide-react';
import { Role, setSession } from '../../lib/session';

interface StaffSignInProps {
  onAuthenticated: (token: string, role: Role) => void;
}

/** Which control is mid-flight, so each can carry its own pending label. */
type Pending = 'form' | 'demo' | null;

export const StaffSignIn: React.FC<StaffSignInProps> = ({ onAuthenticated }) => {
  const [pin, setPin] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [demoPin, setDemoPin] = useState<string | null>(null);

  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  // The demo PIN is served by the API rather than compiled into the bundle, so
  // rotating it does not require a rebuild.
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/demo-hint', { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => setDemoPin(d.demoPin ?? null))
      .catch(() => { /* the hint is optional; sign-in works without it */ });
    return () => controller.abort();
  }, []);

  // One code path for both doors. The demo button is not a second kind of
  // sign-in — it is the same POST with a PIN the server already publishes, so
  // there is no extra surface to guard and nothing new that can drift.
  const authenticate = async (candidate: string, source: Exclude<Pending, null>) => {
    setAuthError(null);
    setPending(source);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: candidate }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSession(data.token, data.role);
        onAuthenticated(data.token, data.role);
      } else {
        setAuthError(data.error || 'Invalid PIN code.');
      }
    } catch {
      setAuthError('Authentication service error.');
    } finally {
      setPending(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void authenticate(pin, 'form');
  };

  // Both controls are held while either is in flight, so a double submit cannot
  // race two sessions into storage.
  const busy = pending !== null;

  return (
    <div className="max-w-md mx-auto my-16 p-8 border-2 border-[#1A1715] bg-[#F7F4EE]">
      <div className="text-center mb-6">
        <div className="w-10 h-10 bg-[#7A2322] text-[#F7F4EE] flex items-center justify-center mx-auto mb-3">
          <Key className="w-5 h-5" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl text-[#1A1715]">STAFF SERVICE PORTAL</h1>
        <p className="font-serif-body text-xs text-[#665E56] italic mt-1">
          Back-of-house cover dashboard &amp; 86 board control
        </p>
      </div>

      {authError && (
        <p
          id={errorId}
          role="alert"
          className="mb-4 p-3 bg-[#7A2322]/10 border border-[#7A2322] text-[#7A2322] text-xs font-mono-data"
        >
          {authError}
        </p>
      )}

      {/* The invitation sits above the form rather than under the field. As a
          10px brass caption it measured 4.32:1 on paper — under AA, and the
          smallest type on the one screen written to be read by a stranger.
          This is the same pair as the dashboard's read-only banner (6.85:1).
          role="status" also announces it when the fetch lands, so a screen
          reader user hears the demo exists without focusing the field. */}
      {demoPin && (
        <div
          id={hintId}
          role="status"
          className="flex items-start gap-3 mb-6 p-3 border border-[#755C38] bg-[#EFE6D5] text-[#5C4A2E]"
        >
          <Eye className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-[11px] font-mono-data leading-relaxed">
            <span className="font-bold uppercase tracking-wider">Read-only tour.</span>{' '}
            Reviewing this as a portfolio piece? The PIN is{' '}
            <code className="font-bold">{demoPin}</code>, or use the button below. The 86 board
            and cover maths are live; writes are disabled so the public demo stays intact.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={`${fieldId}-pin`} className="block text-xs font-mono-data uppercase tracking-wider text-[#1A1715] mb-1">
            Staff Security PIN
          </label>
          <input
            id={`${fieldId}-pin`}
            type="password"
            required
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter staff PIN"
            aria-invalid={authError ? true : undefined}
            aria-describedby={[authError ? errorId : null, demoPin ? hintId : null]
              .filter(Boolean)
              .join(' ') || undefined}
            className="w-full px-3 py-2 bg-[#EFE6D5] border border-[#38322D] font-mono-data text-sm text-[#1A1715]"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 bg-[#1A1715] hover:bg-[#7A2322] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-widest transition-colors disabled:opacity-60"
        >
          {pending === 'form' ? 'Authenticating…' : 'Authenticate Service Access'}
        </button>
      </form>

      {/* Deliberately the secondary control, though it is the only one a public
          visitor can complete. Making it primary would turn a staff portal into
          a portfolio demo; the PIN field above is what proves the lock is real. */}
      {demoPin && (
        <div className="hairline-top mt-6 pt-6">
          <button
            type="button"
            disabled={busy}
            onClick={() => void authenticate(demoPin, 'demo')}
            className="w-full py-3 border border-[#38322D] text-[#1A1715] hover:border-[#7A2322] hover:text-[#7A2322] text-xs font-sans-ui uppercase tracking-[0.2em] transition-colors disabled:opacity-60"
          >
            {pending === 'demo' ? 'Opening the tour…' : 'Take the read-only tour'}
          </button>
        </div>
      )}
    </div>
  );
};

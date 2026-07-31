import React, { useEffect, useId, useState } from 'react';
import { Key } from 'lucide-react';
import { Role, setSession } from '../../lib/session';

interface StaffSignInProps {
  onAuthenticated: (token: string, role: Role) => void;
}

export const StaffSignIn: React.FC<StaffSignInProps> = ({ onAuthenticated }) => {
  const [pin, setPin] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSession(data.token, data.role);
        onAuthenticated(data.token, data.role);
      } else {
        setAuthError(data.error || 'Invalid PIN code.');
      }
    } catch (err) {
      setAuthError('Authentication service error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-16 p-8 border-2 border-[#1A1715] bg-[#F7F4EE]">
      <div className="text-center mb-6">
        <div className="w-10 h-10 bg-[#7A2322] text-[#F7F4EE] flex items-center justify-center mx-auto mb-3">
          <Key className="w-5 h-5" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl text-[#1A1715]">STAFF SERVICE PORTAL</h1>
        <p className="font-serif-body text-xs text-[#6B635A] italic mt-1">
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
          {demoPin && (
            <p id={hintId} className="text-[10px] font-mono-data text-[#8C6E43] mt-1 leading-relaxed">
              Viewing this as a portfolio piece? Use <code className="font-bold">{demoPin}</code> for a
              read-only tour of the back of house — the 86 board and cover maths are live, but changes are disabled.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-[#1A1715] hover:bg-[#7A2322] text-[#F7F4EE] text-xs font-sans-ui uppercase tracking-widest transition-colors disabled:opacity-60"
        >
          {submitting ? 'Authenticating…' : 'Authenticate Service Access'}
        </button>
      </form>
    </div>
  );
};

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UNLOCK_PIN, useUnlock } from '../lib/unlock';

const LENGTH = 4;

export function UnlockPage() {
  const { unlock } = useUnlock();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function tap(d: string) {
    if (pin.length >= LENGTH) return;
    const next = pin + d;
    setPin(next);
    if (next.length === LENGTH) {
      const ok = unlock(next);
      if (ok) {
        navigate('/', { replace: true });
      } else {
        setError('That is not the PIN.');
        window.setTimeout(() => {
          setPin('');
          setError(null);
        }, 700);
      }
    }
  }

  function backspace() {
    setPin((p) => p.slice(0, -1));
    setError(null);
  }

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <main
      className="flex flex-col items-center justify-between px-6 pt-10 pb-10"
      style={{ minHeight: '100dvh', background: 'var(--color-paper)' }}
    >
      <a href="#pinpad" className="skip-link">Skip to keypad</a>

      <div className="text-center">
        <p className="mono uppercase text-[12px] text-muted">Suki</p>
        <h1 className="text-[24px] mt-1">Enter PIN</h1>
        <p className="text-[13px] text-muted mt-1">The counter is open. Unlock to record.</p>
      </div>

      <div className="flex items-center justify-center gap-3" aria-live="polite" aria-label={`PIN entered: ${pin.length} of ${LENGTH}`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            aria-hidden
            style={{
              width: 24, height: 24, borderRadius: '50%',
              border: '2px solid var(--color-ink)',
              background: i < pin.length ? 'var(--color-ink)' : 'transparent',
              transition: 'background 120ms',
            }}
          />
        ))}
      </div>

      {error && <p role="alert" className="text-[14px]" style={{ color: 'var(--color-utang)' }}>{error}</p>}

      <div id="pinpad" className="grid grid-cols-3 gap-3" role="group" aria-label="PIN keypad">
        {keys.map((k, i) => {
          if (k === '') return <span key={i} aria-hidden />;
          if (k === '⌫') return (
            <button
              key={i}
              type="button"
              className="mono text-[24px]"
              onClick={backspace}
              aria-label="Delete last digit"
              style={{ minHeight: 68, minWidth: 68, border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-tap)' }}
              data-testid="pin-back"
            >
              ⌫
            </button>
          );
          return (
            <button
              key={i}
              type="button"
              onClick={() => tap(k)}
              className="mono text-[24px]"
              aria-label={`Digit ${k}`}
              style={{ minHeight: 68, minWidth: 68, border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-tap)' }}
              data-testid={`pin-${k}`}
            >
              {k}
            </button>
          );
        })}
      </div>

      <p className="text-[12px] text-muted mono text-center">Hint for the design review: {UNLOCK_PIN}</p>
    </main>
  );
}

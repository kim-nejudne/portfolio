import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { PAIRING_PIN_LENGTH } from '../../../shared/constants.js';
import { pairWithPin } from '../lib/api.js';
import { BUTTON_PRIMARY, CARD, INPUT, LABEL, LINK } from '../lib/ui.js';
import { BulbRail } from './BulbRail.js';

interface HostPinEntryProps {
  code: string;
  /** The server traded the PIN for the room's hostToken. The page then joins as host with it. */
  onPaired: (hostToken: string) => void;
}

/**
 * `/host/:code` on a device with no token: type the PIN shown beside the pairing QR (Creating and
 * joining a room, step 3; F70). Nothing secret is on this page, and no socket opens until the server
 * hands back a token.
 */
export function HostPinEntry({ code, onPaired }: HostPinEntryProps) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = pin.length === PAIRING_PIN_LENGTH && !busy;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    pairWithPin(code, pin).then(onPaired, (err: unknown) => {
      setBusy(false);
      setPin('');
      setError(err instanceof Error ? err.message : String(err));
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <BulbRail count={9} variant="row" />
      <form
        onSubmit={submit}
        aria-labelledby="pin-heading"
        className={`flex w-full flex-col gap-4 ${CARD}`}
      >
        <h1 id="pin-heading" className="font-display text-3xl">
          Pair this phone
        </h1>
        <p className="text-lg text-muted">
          On the Screen, tap <strong className="text-ink">Pair host phone</strong>, then type the
          PIN shown beside the QR. Room {code}.
        </p>
        <label htmlFor="pairing-pin" className={LABEL}>
          Pairing PIN
        </label>
        <input
          id="pairing-pin"
          value={pin}
          onChange={(event) =>
            setPin(event.target.value.replace(/\D/g, '').slice(0, PAIRING_PIN_LENGTH))
          }
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          enterKeyHint="go"
          maxLength={PAIRING_PIN_LENGTH}
          aria-invalid={error !== null}
          aria-describedby={error ? 'pin-error' : undefined}
          className={`${INPUT} text-center text-4xl tracking-[0.15em] tabular-nums placeholder:text-edge`}
        />
        {error && (
          <p id="pin-error" role="alert" className="text-lg text-buzz">
            {error}
          </p>
        )}
        <button type="submit" disabled={!ready} className={`${BUTTON_PRIMARY} text-2xl`}>
          {busy ? 'Pairing…' : 'Pair'}
        </button>
      </form>
      <Link to="/" className={`${LINK} text-lg`}>
        Back to start
      </Link>
    </main>
  );
}

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { PAIRING_PIN_LENGTH } from '../../../shared/constants.js';
import { pairWithPin } from '../lib/api.js';
import { BUTTON_PRIMARY, LABEL, LINK } from '../lib/ui.js';

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
    // Top-aligned on a phone, so an on-screen keyboard leaves Pair in view; centred from `md`. On a
    // short screen (a phone with the keyboard up, or sideways) the form tightens (HST-08). The form
    // sits on the paper, as the phone's join form does (F135).
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center gap-6 px-4 py-6 text-center md:justify-center short:gap-3 short:py-3">
      <form
        onSubmit={submit}
        aria-labelledby="pin-heading"
        className="flex w-full flex-col gap-4 short:gap-3"
      >
        <h1 id="pin-heading" className="text-3xl uppercase">
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
          // INPUT's 2px ink edge with the PIN as an Anybody figure (design.md); the placeholder stays Archivo.
          className="w-full rounded-control border-2 border-ink bg-bg px-4 py-3 text-center font-display text-4xl font-black tracking-[0.1em] font-stretch-150% tabular-nums placeholder:font-sans placeholder:font-normal placeholder:text-muted"
        />
        {error && (
          <p id="pin-error" role="alert" className="text-lg text-buzz">
            {error}
          </p>
        )}
        <button type="submit" disabled={!ready} className={`${BUTTON_PRIMARY} min-h-14 text-2xl`}>
          {busy ? 'Pairing…' : 'Pair'}
        </button>
      </form>
      <Link to="/" className={`${LINK} text-lg`}>
        Back to start
      </Link>
    </main>
  );
}

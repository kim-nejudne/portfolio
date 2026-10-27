import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { PAIRING_QR_TTL_MS } from '../../../shared/constants.js';
import { pairUrl } from '../lib/joinUrl.js';

interface PairHostPhoneProps {
  code: string;
  hostToken: string;
  /** Text size class: viewport units on the Screen, a fixed size on a phone. Spacing scales with it. */
  className: string;
  /** CSS width and height of the QR. */
  qrSize: string;
}

/**
 * **Pair host phone**: a QR to `/host/:code#t=<hostToken>` for 60 seconds, then hidden
 * (Creating and joining a room, step 3). Shown only on devices that hold the token (DECISIONS #14).
 */
export function PairHostPhone({ code, hostToken, className, qrSize }: PairHostPhoneProps) {
  // A fixed deadline, not a tick count: throttled timers (background tabs, phones) fire late, and the
  // QR shows a usable token, so it must not outlive 60 s of wall-clock time.
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => {
      const time = Date.now();
      if (time >= deadline) setDeadline(null);
      else setNow(time);
    }, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  function show() {
    const time = Date.now();
    setNow(time);
    setDeadline(time + PAIRING_QR_TTL_MS);
  }

  if (deadline === null) {
    return (
      <button
        type="button"
        onClick={show}
        className={`self-start rounded-2xl border-2 border-edge bg-surface px-[1em] py-[0.5em] font-display transition active:scale-95 ${className}`}
      >
        Pair host phone
      </button>
    );
  }

  const url = pairUrl(window.location.origin, code, hostToken);
  const secondsLeft = Math.ceil((deadline - now) / 1000);
  return (
    <section
      aria-label="Pair host phone"
      className={`flex flex-col items-start gap-[0.5em] ${className}`}
    >
      <p>Scan with the host’s phone</p>
      <div className="rounded-2xl bg-white p-[0.6em]">
        <QRCodeSVG
          value={url}
          title="Pair a host phone"
          marginSize={0}
          style={{ width: qrSize, height: qrSize }}
        />
      </div>
      <p className="text-muted">Hides in {secondsLeft} s</p>
      <button
        type="button"
        onClick={() => setDeadline(null)}
        className="underline underline-offset-4"
      >
        Hide
      </button>
    </section>
  );
}

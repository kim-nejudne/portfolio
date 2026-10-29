import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PAIRING_QR_TTL_MS } from '../../../shared/constants.js';
import { HOVER } from '../lib/hover.js';
import { joinPageOrigin, pairUrl } from '../lib/joinUrl.js';
import { useJoinOrigin } from '../lib/useJoinOrigin.js';
import { useRoomStore } from '../lib/roomStore.js';

interface PairHostPhoneProps {
  code: string;
  hostToken: string;
  /** Classes for the button: text size and placement. Spacing scales with the text. */
  className: string;
  /** Text size class for the dialog: viewport units on the Screen, a fixed size on a phone. */
  dialogClassName: string;
  /** CSS width and height of the QR. */
  qrSize: string;
}

/** An open pairing QR: when it hides, and how many hosts had joined when it opened. */
interface Pairing {
  deadline: number;
  hostJoins: number;
}

/**
 * **Pair host phone**: a dialog with a QR to `/host/:code#t=<hostToken>` for 60 seconds, then hidden
 * (Creating and joining a room, step 3). Shown only on devices that hold the token (DECISIONS #14).
 * It opens over the page, so the lobby keeps its layout (F38), and it closes on Hide, Esc, the
 * deadline, or as soon as another host device joins. The link uses the join origin, as the join QR
 * does, so a Screen on localhost hands the phone an address it can open (F52).
 */
export function PairHostPhone({
  code,
  hostToken,
  className,
  dialogClassName,
  qrSize,
}: PairHostPhoneProps) {
  // A fixed deadline, not a tick count: throttled timers (background tabs, phones) fire late, and the
  // QR shows a usable token, so it must not outlive 60 s of wall-clock time.
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [now, setNow] = useState(0);
  const hostJoins = useRoomStore((state) => state.hostJoins);
  const joinOrigin = useJoinOrigin();
  // A host joining is the point of the QR, so it closes at once (F38).
  const open = pairing !== null && pairing.hostJoins === hostJoins;
  const deadline = open ? pairing.deadline : null;

  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => {
      const time = Date.now();
      if (time >= deadline) setPairing(null);
      else setNow(time);
    }, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  function show() {
    const time = Date.now();
    setNow(time);
    setPairing({ deadline: time + PAIRING_QR_TTL_MS, hostJoins });
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        className={`rounded-2xl border-2 border-edge bg-surface px-[1em] py-[0.5em] font-display transition not-disabled:active:scale-95 ${HOVER} ${className}`}
      >
        Pair host phone
      </button>
      {deadline !== null && (
        <PairingDialog
          url={pairUrl(joinPageOrigin(joinOrigin ?? null, window.location), code, hostToken)}
          secondsLeft={Math.ceil((deadline - now) / 1000)}
          onHide={() => setPairing(null)}
          className={dialogClassName}
          qrSize={qrSize}
        />
      )}
    </>
  );
}

interface PairingDialogProps {
  url: string;
  secondsLeft: number;
  onHide: () => void;
  className: string;
  qrSize: string;
}

function PairingDialog({ url, secondsLeft, onHide, className, qrSize }: PairingDialogProps) {
  const hideRef = useRef<HTMLButtonElement>(null);

  // Hide is the only control, so it takes focus, and focus goes back to where it was on any close.
  useEffect(() => {
    const before = document.activeElement;
    hideRef.current?.focus();
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, []);

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    // Modal: Tab stays on Hide, and Esc belongs to the dialog, so nothing behind it acts on the press.
    if (event.key === 'Tab') {
      event.preventDefault();
      hideRef.current?.focus();
    } else if (event.key === 'Escape') {
      event.stopImmediatePropagation();
      onHide();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener, { capture: true });
    return () => window.removeEventListener('keydown', listener, { capture: true });
  }, []);

  // On body, not in the lobby: the lobby column is a size container, which would confine a fixed child.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/85 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pair host phone"
        className={`flex flex-col items-center gap-[0.6em] rounded-[1em] border-2 border-edge bg-surface p-[1.2em] text-center ${className}`}
      >
        <p className="font-display text-[1.3em]">Scan with the host’s phone</p>
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
          ref={hideRef}
          type="button"
          onClick={onHide}
          className={`rounded-2xl border-2 border-edge bg-bg px-[1em] py-[0.3em] font-display transition active:scale-95 ${HOVER}`}
        >
          Hide{' '}
          <kbd
            aria-hidden
            className="ml-[0.3em] hidden font-mono pointer-fine:inline text-[0.8em] opacity-70"
          >
            Esc
          </kbd>
        </button>
      </div>
    </div>,
    document.body,
  );
}

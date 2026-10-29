import { useState } from 'react';
import { useNavigate } from 'react-router';
import { HOVER } from '../lib/hover.js';
import { displayUrl } from '../lib/joinUrl.js';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD } from '../lib/ui.js';

/** Creating and joining a room, step 2: once the room exists, ask where the Screen is. */
export function RoomCreated({ code }: { code: string }) {
  const navigate = useNavigate();
  const [showScreenUrl, setShowScreenUrl] = useState(false);
  const screenUrl = `${window.location.origin}/screen/${code}`;

  return (
    <section
      aria-labelledby="host-heading"
      className={`flex flex-col gap-4 ${CARD} shadow-[0_0_0_6px_var(--color-bg),0_0_0_10px_var(--color-accent)]`}
    >
      <h2 id="host-heading" className="font-display text-3xl">
        Room created
      </h2>
      <p className="text-center font-display text-6xl tracking-[0.2em] text-accent">{code}</p>
      <button
        type="button"
        onClick={() => void navigate(`/screen/${code}`)}
        className={`${BUTTON_PRIMARY} py-5 text-2xl ${HOVER}`}
      >
        Use this device as the Screen
      </button>
      <button
        type="button"
        aria-expanded={showScreenUrl}
        onClick={() => setShowScreenUrl((shown) => !shown)}
        className={`${BUTTON_SECONDARY} py-5 font-display text-2xl ${HOVER}`}
      >
        Open the Screen on another device
      </button>
      {showScreenUrl && (
        <p className="text-center text-lg text-muted">
          On the TV device, open{' '}
          <strong className="break-all text-ink">{displayUrl(screenUrl)}</strong>
          <br />
          Room code <strong className="font-display tracking-widest text-ink">{code}</strong>
        </p>
      )}
      {/* hostSet already kept the hostToken (saveHostToken), so the remote joins without a pairing hash. */}
      <button
        type="button"
        onClick={() => void navigate(`/host/${code}`)}
        className={`${BUTTON_SECONDARY} py-5 font-display text-2xl ${HOVER}`}
      >
        Use this phone as the host remote
      </button>
    </section>
  );
}

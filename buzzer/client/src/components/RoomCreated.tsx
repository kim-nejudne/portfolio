import { useState } from 'react';
import { useNavigate } from 'react-router';
import { displayUrl } from '../lib/joinUrl.js';

const bigButton =
  'rounded-3xl px-6 py-6 font-display text-2xl transition active:scale-95 disabled:opacity-40';

/** Creating and joining a room, step 2: once the room exists, ask where the Screen is. */
export function RoomCreated({ code }: { code: string }) {
  const navigate = useNavigate();
  const [showScreenUrl, setShowScreenUrl] = useState(false);
  const screenUrl = `${window.location.origin}/screen/${code}`;

  return (
    <section
      aria-labelledby="host-heading"
      className="flex flex-col gap-4 rounded-3xl border-2 border-accent bg-surface p-6"
    >
      <h2 id="host-heading" className="font-display text-3xl">
        Room created
      </h2>
      <p className="text-center font-display text-6xl tracking-[0.2em] text-accent">{code}</p>
      <button
        type="button"
        onClick={() => void navigate(`/screen/${code}`)}
        className={`${bigButton} bg-accent text-accent-ink`}
      >
        Use this device as the Screen
      </button>
      <button
        type="button"
        aria-expanded={showScreenUrl}
        onClick={() => setShowScreenUrl((shown) => !shown)}
        className={`${bigButton} border-2 border-edge`}
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
    </section>
  );
}

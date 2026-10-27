import { useState } from 'react';
import { useNavigate } from 'react-router';
import { DEFAULT_SETTINGS } from '../../../shared/constants.js';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import { createRoom } from '../lib/api.js';
import { saveHostToken } from '../lib/hostTokens.js';
import { displayUrl } from '../lib/joinUrl.js';

type Status =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'created'; code: string }
  | { kind: 'error'; message: string };

const bigButton =
  'rounded-3xl px-6 py-6 font-display text-3xl transition active:scale-95 disabled:opacity-40';

/**
 * Host a game (Creating and joining a room, steps 1–2): creates a room, keeps its hostToken on this
 * device, then asks where the Screen is.
 */
export function HostGame() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [showScreenUrl, setShowScreenUrl] = useState(false);

  async function host() {
    setStatus({ kind: 'creating' });
    try {
      // SPEC-QUESTION: no set picker until F25, so every room uses the sample set (DECISIONS, F08).
      // TODO(F25): pick one of this browser's saved sets instead.
      const { code, hostToken } = await createRoom({ set: SAMPLE_SET, settings: DEFAULT_SETTINGS });
      saveHostToken(code, hostToken);
      setStatus({ kind: 'created', code });
    } catch (error) {
      setStatus({ kind: 'error', message: (error as Error).message });
    }
  }

  if (status.kind !== 'created') {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void host()}
          disabled={status.kind === 'creating'}
          className={`${bigButton} border-2 border-accent text-accent`}
        >
          {status.kind === 'creating' ? 'Creating room…' : 'Host a game'}
        </button>
        {status.kind === 'error' && (
          <p role="alert" className="text-center text-lg text-red-400">
            {status.message}
          </p>
        )}
      </div>
    );
  }

  const { code } = status;
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
        className={`${bigButton} bg-accent text-2xl text-accent-ink`}
      >
        Use this device as the Screen
      </button>
      <button
        type="button"
        aria-expanded={showScreenUrl}
        onClick={() => setShowScreenUrl((shown) => !shown)}
        className={`${bigButton} border-2 border-edge text-2xl`}
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

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ROOM_CODE_LENGTH } from '#shared/constants.js';
import type { RoomExistsResponse } from '#shared/types.js';
import { SplitFlap } from '../components/SplitFlap.js';

export const UNKNOWN_CODE_ERROR = 'No game with that code';
// SPEC-QUESTION: DECISIONS 17 (the landing page's network error text)
export const NETWORK_ERROR = "Can't reach the game. Check your connection and try again.";

const CARD = 'flex min-w-0 flex-col gap-4 rounded-card border border-line bg-board-panel p-6';
const BUTTON_PRIMARY =
  'min-h-12 rounded-button bg-amber px-6 text-lg font-semibold text-board-bg [@media(hover:hover)]:hover:brightness-110 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100';

/** The server's `{error}` text, or the network error when there is none. */
async function errorOf(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === 'string' ? body.error : NETWORK_ERROR;
}

export function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showError, setShowError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'join' | 'show' | null>(null);

  async function join(event: FormEvent) {
    event.preventDefault();
    if (code.length !== ROOM_CODE_LENGTH || busy) return;
    setBusy('join');
    setJoinError(null);
    try {
      const res = await fetch(`/api/rooms/${code}/exists`);
      if (!res.ok) return setJoinError(await errorOf(res));
      const { exists } = (await res.json()) as RoomExistsResponse;
      // SPEC-QUESTION: DECISIONS 17 (a full room is the join form's error, so its players can still rejoin)
      if (!exists) return setJoinError(UNKNOWN_CODE_ERROR);
      void navigate(`/play/${code}`);
    } catch {
      setJoinError(NETWORK_ERROR);
    } finally {
      setBusy(null);
    }
  }

  async function show() {
    if (busy) return;
    setBusy('show');
    setShowError(null);
    try {
      const res = await fetch('/api/rooms', { method: 'POST' });
      if (!res.ok) return setShowError(await errorOf(res));
      const { code: created } = (await res.json()) as { code: string };
      void navigate(`/screen/${created}`);
    } catch {
      setShowError(NETWORK_ERROR);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col justify-center gap-10 px-4 py-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1>
          <SplitFlap
            text="PINPOINT"
            label="Pinpoint"
            cellClass="h-12 w-9 rounded-flap-phone text-3xl sm:h-20 sm:w-14 sm:rounded-flap-screen sm:text-5xl"
          />
        </h1>
        <p className="text-lg text-text">Find it on the map. Closest pin wins.</p>
      </div>

      {/* Two choices of equal weight: side by side from 768 px, stacked below. */}
      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={join} aria-labelledby="join-heading" className={CARD}>
          <h2 id="join-heading" className="text-2xl font-bold">
            Join a game
          </h2>
          <label htmlFor="room-code" className="font-semibold text-text-dim">
            Room code
          </label>
          <input
            id="room-code"
            value={code}
            onChange={(e) => {
              setCode(
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z]/g, '')
                  .slice(0, ROOM_CODE_LENGTH),
              );
              setJoinError(null);
            }}
            placeholder="ABCD"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={joinError !== null}
            aria-describedby={joinError ? 'join-error' : undefined}
            className="board-face h-16 w-full min-w-0 rounded-button border border-line bg-board-bg px-4 text-center text-4xl tracking-[0.3em] text-text placeholder:text-text-dim"
          />
          {joinError && (
            <p id="join-error" role="alert" className="text-delayed">
              {joinError}
            </p>
          )}
          <button
            type="submit"
            disabled={code.length !== ROOM_CODE_LENGTH || busy !== null}
            className={`${BUTTON_PRIMARY} mt-auto`}
          >
            {busy === 'join' ? 'Joining…' : 'Join'}
          </button>
        </form>

        <section aria-labelledby="show-heading" className={CARD}>
          <h2 id="show-heading" className="text-2xl font-bold">
            Show a game on this screen
          </h2>
          <p className="text-text-dim">Use the device everyone can see: a laptop on the TV.</p>
          {showError && (
            <p role="alert" className="text-delayed">
              {showError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void show()}
            disabled={busy !== null}
            className={`${BUTTON_PRIMARY} mt-auto`}
          >
            {busy === 'show' ? 'Opening…' : 'Show'}
          </button>
        </section>
      </div>
    </main>
  );
}

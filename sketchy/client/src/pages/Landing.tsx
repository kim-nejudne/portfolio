import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { createRoom, roomExists } from '../lib/api.js';
import { saveHostToken } from '../lib/hostTokens.js';

/** Room codes use these letters (no I, L or O); the server checks the code itself. */
const CODE_LETTERS = /[^ABCDEFGHJKMNPQRSTUVWXYZ]/g;

/**
 * The landing page (UI by role and phase, Landing page): **Join a game** with a code, or **Start a
 * game on this screen**, which creates a room, keeps its hostToken on this device and opens the
 * Screen. English only.
 */
export function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  // Blocks a second POST from a fast double tap before `starting` re-renders the button.
  const startingRef = useRef(false);

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 4) return;
    setChecking(true);
    setJoinError(null);
    try {
      const room = await roomExists(code);
      if (!room.exists) setJoinError('No game with that code. Check the TV.');
      else if (room.full) setJoinError('That game is full.');
      else void navigate(`/play/${code}`);
    } catch (err) {
      setJoinError((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const start = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setStartError(null);
    try {
      const room = await createRoom();
      saveHostToken(room.code, room.hostToken);
      void navigate(`/screen/${room.code}`);
    } catch (err) {
      setStartError((err as Error).message);
      startingRef.current = false;
      setStarting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-[max(1rem,env(safe-area-inset-left))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="pt-2 text-center">
        <h1 className="font-display text-5xl font-bold">✏️ Sketchy</h1>
        <p className="mt-2 text-lg text-white/70">Draw it. Guess it. Laugh.</p>
      </header>

      <form onSubmit={join} className="flex flex-col gap-2 rounded-2xl bg-white/5 p-4">
        <label htmlFor="code" className="text-xl font-semibold">
          Join a game
        </label>
        <div className="flex gap-3">
          <input
            id="code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(CODE_LETTERS, '').slice(0, 4));
              setJoinError(null);
            }}
            placeholder="CODE"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="go"
            aria-describedby="join-error"
            className="min-h-12 w-full min-w-0 rounded-xl bg-white px-4 text-center font-mono text-2xl font-bold tracking-[0.4em] text-[#1D1B22] uppercase placeholder:text-[#1D1B22]/50"
          />
          <button
            type="submit"
            disabled={code.length !== 4 || checking}
            className="min-h-12 shrink-0 rounded-xl bg-[#FF6B35] px-5 text-xl font-bold text-[#1D1B22] disabled:opacity-40"
          >
            Join
          </button>
        </div>
        <p id="join-error" role="alert" className="min-h-6 text-[#FF8FA3]">
          {joinError}
        </p>
      </form>

      <section className="flex flex-col gap-2 rounded-2xl bg-white/5 p-4">
        <h2 className="text-xl font-semibold">Start a game on this screen</h2>
        <p className="text-white/70">
          Use the device everyone can see: a laptop on the TV, a tablet, or a spare phone.
        </p>
        <button
          type="button"
          onClick={start}
          disabled={starting}
          className="min-h-12 rounded-xl border-2 border-[#FF6B35] px-5 text-xl font-bold text-[#FF6B35] disabled:opacity-40"
        >
          Start
        </button>
        <p role="alert" className="min-h-6 text-[#FF8FA3]">
          {startError}
        </p>
      </section>
    </main>
  );
}

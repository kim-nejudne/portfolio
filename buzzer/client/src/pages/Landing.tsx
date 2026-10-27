import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { APP_NAME, ROOM_CODE_LENGTH } from '../../../shared/constants.js';
import { HostGame } from '../components/HostGame.js';
import { isCompleteRoomCode, normalizeRoomCode } from '../lib/roomCode.js';

export function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const ready = isCompleteRoomCode(code);

  function join(event: FormEvent) {
    event.preventDefault();
    if (ready) void navigate(`/play/${code}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-4 py-10">
      <h1 className="text-center font-display text-6xl tracking-tight text-accent">{APP_NAME}</h1>

      <form
        onSubmit={join}
        aria-labelledby="join-heading"
        className="flex flex-col gap-4 rounded-3xl border-2 border-edge bg-surface p-6"
      >
        <h2 id="join-heading" className="font-display text-3xl">
          Join a game
        </h2>
        <label htmlFor="room-code" className="text-lg text-muted">
          Room code
        </label>
        <input
          id="room-code"
          value={code}
          onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
          placeholder="ABCD"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={ROOM_CODE_LENGTH}
          className="w-full rounded-2xl border-2 border-edge bg-bg px-4 py-3 text-center font-display text-5xl tracking-[0.3em] uppercase placeholder:text-edge focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={!ready}
          className="rounded-2xl bg-accent px-6 py-4 font-display text-2xl text-accent-ink transition active:scale-95 disabled:opacity-40"
        >
          Join
        </button>
      </form>

      <HostGame />

      <Link
        to="/sets"
        className="text-center text-lg text-muted underline underline-offset-4 hover:text-ink"
      >
        My question sets
      </Link>
    </main>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { APP_NAME, ROOM_CODE_LENGTH } from '../../../shared/constants.js';
import { BulbRail } from '../components/BulbRail.js';
import { HostGame } from '../components/HostGame.js';
import { isCompleteRoomCode, normalizeRoomCode } from '../lib/roomCode.js';
import { BUTTON_PRIMARY, CARD, INPUT, LABEL, LINK } from '../lib/ui.js';

export function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  // While Host a game's picker (or its created room) shows, it takes the Join card's place.
  const [hosting, setHosting] = useState(false);
  const ready = isCompleteRoomCode(code);

  function join(event: FormEvent) {
    event.preventDefault();
    if (ready) void navigate(`/play/${code}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-4">
        <BulbRail count={9} variant="row" />
        <h1 className="text-center font-display text-6xl text-accent [text-shadow:4px_4px_0_var(--color-bg-deep)]">
          {APP_NAME}
        </h1>
        <p className="text-center text-lg text-muted">
          A game-show buzzer: questions on the TV, buzzers on your phones
        </p>
      </div>

      {!hosting && (
        <form
          onSubmit={join}
          aria-labelledby="join-heading"
          className={`flex flex-col gap-4 ${CARD}`}
        >
          <h2 id="join-heading" className="font-display text-3xl">
            Join a game
          </h2>
          <label htmlFor="room-code" className={LABEL}>
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
            className={`${INPUT} text-center text-5xl tracking-[0.3em] uppercase placeholder:text-edge`}
          />
          <button type="submit" disabled={!ready} className={`${BUTTON_PRIMARY} text-2xl`}>
            Join
          </button>
        </form>
      )}

      <HostGame onOpenChange={setHosting} />

      <Link to="/sets" className={`${LINK} self-center text-lg`}>
        Question sets
      </Link>
    </main>
  );
}

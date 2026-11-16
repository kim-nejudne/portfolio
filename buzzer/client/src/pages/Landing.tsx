import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { APP_NAME, ROOM_CODE_LENGTH } from '../../../shared/constants.js';
import { HostGame } from '../components/HostGame.js';
import { PageShell } from '../components/PageShell.js';
import { isCompleteRoomCode, normalizeRoomCode } from '../lib/roomCode.js';
import { LABEL, LANDING_ACTION, LANDING_BUTTON, LINK } from '../lib/ui.js';

const TILES = Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => index);

export function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  // While Host a game's picker (or its created room) shows, it takes the Join form's place.
  const [hosting, setHosting] = useState(false);
  const ready = isCompleteRoomCode(code);
  // The tile the next letter lands in; the last one once the code is full.
  const next = Math.min(code.length, ROOM_CODE_LENGTH - 1);

  function join(event: FormEvent) {
    event.preventDefault();
    if (ready) void navigate(`/play/${code}`);
  }

  return (
    <PageShell
      width="wide"
      // On a tall window the hero and the actions sit mid-page, not at the top (LND-01). The
      // open picker stays top-aligned, so filtering its list never moves its search box.
      className={hosting ? '' : 'gap-10 lg:flex-1 lg:justify-center lg:gap-14'}
    >
      <div className="flex flex-col gap-3">
        <h1
          className={`font-display leading-none text-ink ${hosting ? 'text-4xl' : 'text-7xl md:text-8xl lg:text-9xl'}`}
        >
          {APP_NAME}
        </h1>
        {!hosting && (
          <p className="text-lg text-muted md:text-2xl">
            A game-show buzzer: questions on the TV, buzzers on your phones
          </p>
        )}
      </div>

      {/* Join and Host: the two actions, side by side from a tablet up. */}
      <div className="grid gap-8 md:grid-cols-2 md:items-end md:gap-12">
        {!hosting && (
          <form onSubmit={join} aria-labelledby="join-heading" className={LANDING_ACTION}>
            <h2 id="join-heading" className="sr-only">
              Join a game
            </h2>
            <label htmlFor="room-code" className={LABEL}>
              Room code
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch md:flex-col lg:flex-row">
              {/* The signature: one input, drawn as four Gabarito tiles (design.md). */}
              <div className="relative grid w-full max-w-xs grid-cols-4 gap-2 sm:w-72 md:w-full lg:w-72">
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
                  // 16px keeps iOS from zooming in on focus; the tiles show the letters.
                  className="peer absolute inset-0 size-full cursor-text text-base opacity-0"
                />
                {TILES.map((index) => (
                  <span
                    key={index}
                    aria-hidden="true"
                    className={`flex aspect-square items-center justify-center rounded-control border-2 bg-surface font-display text-4xl font-extrabold text-ink sm:text-5xl ${
                      index === next ? 'border-muted peer-focus:border-focus' : 'border-muted'
                    }`}
                  >
                    {code[index]}
                  </span>
                ))}
              </div>
              <button type="submit" disabled={!ready} className={LANDING_BUTTON}>
                Join
              </button>
            </div>
          </form>
        )}

        <HostGame onOpenChange={setHosting}>
          <Link to="/sets" className={`${LINK} self-start`}>
            Question sets
          </Link>
        </HostGame>
      </div>
    </PageShell>
  );
}

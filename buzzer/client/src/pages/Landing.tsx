import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { APP_NAME, ROOM_CODE_LENGTH } from '../../../shared/constants.js';
import { HostGame } from '../components/HostGame.js';
import { PageShell } from '../components/PageShell.js';
import { isCompleteRoomCode, normalizeRoomCode } from '../lib/roomCode.js';
import { LANDING_ACTION, LANDING_BUTTON, LINK } from '../lib/ui.js';

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
      // The hero and the passes sit mid-window, as the mock (LND-01). The open picker stays
      // top-aligned, so filtering its list never moves its search box.
      className={hosting ? '' : 'flex-1 justify-center gap-10'}
    >
      <div className="flex flex-col gap-6">
        <h1
          className={`leading-none text-ink uppercase ${hosting ? 'text-4xl' : 'text-[clamp(4rem,15vw,13.5rem)]'}`}
        >
          {APP_NAME}
        </h1>
        {!hosting && (
          <p className="max-w-[36ch] text-xl text-ink md:text-2xl">
            A game-show buzzer: questions on the TV, buzzers on your phones
          </p>
        )}
      </div>

      {/* Join on the teal pass and Host on the orange, crossing in moss (index.css `.passes`). The
          picker and the created room take this slot, across both columns. */}
      <div className={hosting ? 'grid gap-8 md:grid-cols-2' : 'passes'}>
        {!hosting && (
          <form onSubmit={join} aria-labelledby="join-heading" className={LANDING_ACTION}>
            <h2 id="join-heading" className="sr-only">
              Join a game
            </h2>
            <label htmlFor="room-code" className="font-outlier text-sm font-semibold">
              Room code
            </label>
            <div className="flex flex-wrap items-center gap-4">
              {/* The signature: one input, drawn as four display-face tiles (design.md). They fill
                  the pass's clear column, up to the mock's 5rem each, so none reaches the moss. */}
              <div className="relative grid w-full max-w-86 grid-cols-4 gap-2 has-focus-visible:outline-3 has-focus-visible:outline-offset-4 has-focus-visible:outline-ink">
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
                    className={`flex aspect-square items-center justify-center bg-paper font-display text-3xl leading-none font-black text-ink font-stretch-150% sm:text-4xl ${
                      index === next
                        ? 'inset-ring-2 inset-ring-ink peer-focus:inset-ring-4'
                        : 'inset-ring-2 inset-ring-ink'
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
          <Link to="/sets" className={LINK}>
            Question sets
          </Link>
        </HostGame>
      </div>
    </PageShell>
  );
}

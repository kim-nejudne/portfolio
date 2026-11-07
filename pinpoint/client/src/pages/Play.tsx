import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EMOJI, GAME_ENDED_ERROR, KICKED_ERROR, NAME_MAX } from '#shared/constants.js';
import type { GameSettings, PlayerView, RoomExistsResponse } from '#shared/types.js';
import {
  clearPlayer,
  loadPlayer,
  newPlayerKey,
  savePlayer,
  type PlayerIdentity,
} from '../lib/playerIdentity.js';
import { useRoomStore, type RoomState } from '../lib/roomStore.js';
import { createSocket, type GameSocket } from '../lib/socket.js';
import { useRoomSocket } from '../lib/useRoomSocket.js';
import { useWakeLock } from '../lib/useWakeLock.js';

type Emoji = PlayerIdentity['emoji'];
interface Draft {
  name: string;
  emoji: Emoji | null;
  error: string | null;
}

const BUTTON_PRIMARY =
  'min-h-12 rounded-button bg-amber px-6 text-lg font-semibold text-board-bg [@media(hover:hover)]:hover:brightness-110 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100';
const BUTTON_SECONDARY =
  'min-h-12 rounded-button border border-line px-6 font-semibold text-text [@media(hover:hover)]:hover:bg-board-bg active:scale-[0.96]';
const INPUT =
  'h-12 w-full min-w-0 rounded-button border border-line bg-board-panel px-4 text-text placeholder:text-text-dim';

/** Refusals that end the page; any other refused join goes back to the form with its text. */
const FATAL = new Set<string>([GAME_ENDED_ERROR, KICKED_ERROR]);

export function Play({ makeSocket = createSocket }: { makeSocket?: () => GameSocket }) {
  const code = (useParams().code ?? '').toUpperCase();
  // A stored identity rejoins silently; otherwise the form runs first, with this device's key.
  const [identity, setIdentity] = useState(() => loadPlayer(code));
  const [playerKey] = useState(() => identity?.playerKey ?? newPlayerKey());
  const [draft, setDraft] = useState<Draft>({ name: '', emoji: null, error: null });

  if (!identity) {
    return (
      <JoinForm
        code={code}
        draft={draft}
        onJoin={(name, emoji) => setIdentity({ playerKey, name, emoji })}
      />
    );
  }
  return (
    <PlayerRoom
      code={code}
      identity={identity}
      makeSocket={makeSocket}
      onRefused={(error) => {
        clearPlayer(code); // a refused stored identity must not retry on every refresh
        setDraft({ name: identity.name, emoji: identity.emoji, error });
        setIdentity(null);
      }}
    />
  );
}

function Message({ text }: { text: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-4 text-center">
      <h1 className="board-face text-3xl text-amber">{text}</h1>
      <Link to="/" className={`${BUTTON_SECONDARY} flex items-center`}>
        Back to Pinpoint
      </Link>
    </main>
  );
}

function JoinForm({
  code,
  draft,
  onJoin,
}: {
  code: string;
  draft: Draft;
  onJoin: (name: string, emoji: Emoji) => void;
}) {
  const [name, setName] = useState(draft.name);
  const [emoji, setEmoji] = useState(draft.emoji);
  const [error, setError] = useState(draft.error);
  const [taken, setTaken] = useState<string[]>([]);
  const [ended, setEnded] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let live = true;
    // A failed check leaves every emoji enabled: the server still refuses a taken one.
    fetch(`/api/rooms/${code}/exists`)
      .then((res) => (res.ok ? (res.json() as Promise<RoomExistsResponse>) : null))
      .then((body) => {
        if (!live || !body) return;
        if (!body.exists) setEnded(true);
        else setTaken(body.takenEmoji);
      })
      .catch(() => {})
      .finally(() => live && setChecking(false));
    return () => {
      live = false;
    };
  }, [code]);

  if (ended) return <Message text={GAME_ENDED_ERROR} />;

  const free = (e: string) => !taken.includes(e);
  const chosen = emoji && free(emoji) ? emoji : (EMOJI.find(free) ?? null);
  const canJoin = !checking && name.trim() !== '' && chosen !== null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (canJoin) onJoin(name.trim(), chosen);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8">
      <form onSubmit={submit} className="flex flex-col gap-6" aria-labelledby="join-heading">
        <h1 id="join-heading" className="text-2xl font-bold">
          Join game <span className="board-face text-amber">{code}</span>
        </h1>
        <div className="flex flex-col gap-2">
          <label htmlFor="player-name" className="font-semibold text-text-dim">
            Your name
          </label>
          <input
            id="player-name"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            autoComplete="off"
            enterKeyHint="go"
            aria-invalid={error !== null}
            aria-describedby={error ? 'join-error' : undefined}
            className={INPUT}
          />
          {error && (
            <p id="join-error" role="alert" className="text-delayed">
              {error}
            </p>
          )}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold text-text-dim">Your emoji</legend>
          <div className="grid grid-cols-6 gap-2">
            {EMOJI.map((e) => (
              <label key={e} className="relative">
                <input
                  type="radio"
                  name="emoji"
                  value={e}
                  checked={chosen === e}
                  disabled={!free(e)}
                  onChange={() => {
                    setEmoji(e);
                    setError(null);
                  }}
                  aria-label={free(e) ? e : `${e}, taken`}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="flex size-12 items-center justify-center rounded-button bg-board-panel text-2xl peer-checked:ring-2 peer-checked:ring-amber peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-amber peer-disabled:opacity-30"
                >
                  {e}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={!canJoin} className={BUTTON_PRIMARY}>
          {checking ? 'Join…' : 'Join'}
        </button>
      </form>
    </main>
  );
}

function PlayerRoom({
  code,
  identity,
  makeSocket,
  onRefused,
}: {
  code: string;
  identity: PlayerIdentity;
  makeSocket: () => GameSocket;
  onRefused: (error: string) => void;
}) {
  const view = useRoomStore((s) => s.view);
  const error = useRoomStore((s) => s.error);
  const connection = useRoomStore((s) => s.connection);
  const socket = useRoomSocket(
    code,
    (s, ack) =>
      s.emit('player:join', { code, ...identity }, (res) => {
        if (res.ok) savePlayer(code, identity);
        else if (!FATAL.has(res.error)) return onRefused(res.error);
        ack(res);
      }),
    makeSocket,
  );
  const playerView = view?.role === 'player' ? view : null;
  useWakeLock(playerView !== null && !error);

  if (error) return <Message text={error} />;
  if (!playerView) {
    return (
      <p role="status" className="flex min-h-dvh items-center justify-center text-text-dim">
        Joining…
      </p>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        view={playerView}
        connection={connection}
        socket={socket.current}
        onRenamed={(name) => savePlayer(code, { ...identity, name })}
        onLeave={() => clearPlayer(code)}
      />
      {playerView.phase === 'LOBBY' ? (
        <Lobby view={playerView} />
      ) : (
        // shortcut: later phases render here as their features land (F12 onwards).
        <p className="board-face m-auto text-2xl text-amber">{playerView.phase}</p>
      )}
    </div>
  );
}

const DOT: Record<RoomState['connection'], [string, string]> = {
  connected: ['bg-on-time', 'Connected'],
  connecting: ['bg-amber', 'Reconnecting'],
  offline: ['bg-delayed', 'Offline'],
};

/** "1st", "2nd", "3rd", "4th", "11th", "21st". */
export function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

function TopBar({
  view,
  connection,
  socket,
  onRenamed,
  onLeave,
}: {
  view: PlayerView;
  connection: RoomState['connection'];
  socket: GameSocket | null;
  onRenamed: (name: string) => void;
  onLeave: () => void;
}) {
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const { me } = view;
  const [dot, dotLabel] = DOT[connection];
  const menuButton = useRef<HTMLButtonElement>(null);

  function closeMenu() {
    setMenu(false);
    menuButton.current?.focus();
  }

  function leave() {
    onLeave();
    if (!socket?.connected) return void navigate('/');
    socket.emit('player:leave', {}, () => void navigate('/'));
  }

  return (
    <header
      className="relative border-b border-line bg-board-panel"
      onKeyDown={(e) => e.key === 'Escape' && menu && closeMenu()}
    >
      <div className="flex h-14 items-center gap-3 pl-4">
        <span aria-hidden="true" className="text-2xl">
          {me.emoji}
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold">{me.name}</span>
        <span className="board-face shrink-0 text-sm text-text-dim">
          {me.total} · {ordinal(me.rank)} of {view.playerCount}
        </span>
        <span role="img" aria-label={dotLabel} className={`size-3 shrink-0 rounded-full ${dot}`} />
        {connection !== 'connected' && (
          <span aria-hidden="true" className="shrink-0 text-sm text-text-dim">
            {dotLabel}
          </span>
        )}
        <button
          type="button"
          ref={menuButton}
          aria-label="Menu"
          aria-expanded={menu}
          aria-controls="player-menu"
          onClick={() => setMenu(!menu)}
          className="flex size-12 shrink-0 items-center justify-center text-2xl text-text"
        >
          ⋯
        </button>
      </div>
      {menu && (
        <>
          {/* Taps outside the menu close it. */}
          <div className="fixed inset-0 z-10" onClick={closeMenu} />
          <div
            id="player-menu"
            className="absolute top-full right-2 z-20 flex min-w-48 flex-col rounded-card border border-line bg-board-panel p-2"
          >
            {view.phase === 'LOBBY' && (
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setMenu(false);
                  setRenaming(true);
                }}
                className="min-h-12 rounded-button px-4 text-left font-semibold [@media(hover:hover)]:hover:bg-board-bg"
              >
                Change name
              </button>
            )}
            <button
              type="button"
              autoFocus={view.phase !== 'LOBBY'}
              onClick={leave}
              className="min-h-12 rounded-button px-4 text-left font-semibold text-delayed [@media(hover:hover)]:hover:bg-board-bg"
            >
              Leave game
            </button>
          </div>
        </>
      )}
      {renaming && view.phase === 'LOBBY' && (
        <RenameForm
          current={me.name}
          socket={connection === 'connected' ? socket : null}
          onDone={(name) => {
            if (name) onRenamed(name);
            setRenaming(false);
          }}
        />
      )}
    </header>
  );
}

function RenameForm({
  current,
  socket,
  onDone,
}: {
  current: string;
  socket: GameSocket | null;
  onDone: (name: string | null) => void;
}) {
  const [name, setName] = useState(current);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !socket) return;
    socket.emit('player:rename', { name: trimmed }, (res) =>
      res.ok ? onDone(trimmed) : setError(res.error),
    );
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === 'Escape' && onDone(null)}
      className="flex flex-col gap-3 border-t border-line px-4 py-4"
    >
      <label htmlFor="rename" className="font-semibold text-text-dim">
        New name
      </label>
      <input
        id="rename"
        autoFocus
        value={name}
        maxLength={NAME_MAX}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        autoComplete="off"
        enterKeyHint="done"
        aria-invalid={error !== null}
        aria-describedby={error ? 'rename-error' : undefined}
        className={INPUT}
      />
      {error && (
        <p id="rename-error" role="alert" className="text-delayed">
          {error}
        </p>
      )}
      {!socket && <p className="text-text-dim">Reconnecting…</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!name.trim() || !socket}
          className={`${BUTTON_PRIMARY} flex-1`}
        >
          Save
        </button>
        <button type="button" onClick={() => onDone(null)} className={BUTTON_SECONDARY}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** "NAME · MIXED · 10 ROUNDS · 30 S". */
function settingsLine(s: GameSettings): string {
  // shortcut: no category segment yet; the VIP lobby feature (F13) names the category here and on the Screen.
  return [s.mode, s.difficulty, `${s.rounds} rounds`, `${s.timerSeconds} s`]
    .join(' · ')
    .toUpperCase();
}

function Lobby({ view }: { view: PlayerView }) {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-8">
      <p role="status" className="text-xl">
        {view.me.isVip
          ? // shortcut: the VIP's settings card and Start come with the VIP lobby feature (F13).
            "You're the VIP ★"
          : view.vipName
            ? `Waiting for ★ ${view.vipName} to start`
            : 'Waiting for the VIP to start'}
      </p>
      <p className="board-face text-sm text-amber" aria-label="Settings">
        {settingsLine(view.settings)}
      </p>
    </main>
  );
}

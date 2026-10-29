import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  GAME_ENDED_ERROR,
  INVALID_HOST_TOKEN_ERROR,
  ROOM_NOT_FOUND_ERROR,
} from '../../../shared/constants.js';
import type { HostView } from '../../../shared/types.js';
import { BulbRail } from '../components/BulbRail.js';
import { ConnectionDot } from '../components/ConnectionDot.js';
import { HostPlayers } from '../components/HostPlayers.js';
import { HostSettings } from '../components/HostSettings.js';
import { NewGamePicker } from '../components/NewGamePicker.js';
import { PairHostPhone } from '../components/PairHostPhone.js';
import { PrimaryAction } from '../components/PrimaryAction.js';
import { SecondaryActions } from '../components/SecondaryActions.js';
import { Toast, useToast } from '../components/Toast.js';
import { imageUrl } from '../lib/api.js';
import { clearHostToken, loadHostToken, saveHostToken, tokenFromHash } from '../lib/hostTokens.js';
import { isCompleteRoomCode } from '../lib/roomCode.js';
import { useRoomStore } from '../lib/roomStore.js';
import { ordinal } from '../lib/results.js';
import { createSocket, type GameSocket } from '../lib/socket.js';
import { BUTTON_PRIMARY, CARD, LABEL, PILL } from '../lib/ui.js';
import { useHostCommand, useSendHost, type SendHost } from '../lib/useHostCommand.js';
import { usePreloadImage } from '../lib/usePreloadImage.js';
import { useRoomSocket, type JoinRoom } from '../lib/useRoomSocket.js';

interface HostProps {
  /** Tests pass a fake socket. */
  makeSocket?: () => GameSocket;
}

/** The host remote at `/host/:code`. Phone-first, and never shown on the Screen. */
export function Host({ makeSocket = createSocket }: HostProps) {
  const code = (useParams().code ?? '').toUpperCase();
  if (!isCompleteRoomCode(code)) return <HostMessage title="Room not found" />;
  return <HostRoom key={code} code={code} makeSocket={makeSocket} />;
}

function HostRoom({ code, makeSocket }: { code: string; makeSocket: () => GameSocket }) {
  const location = useLocation();
  const navigate = useNavigate();
  // A pairing link's token wins over a stored one: it is the newest grant for this device.
  const [hostToken, setHostToken] = useState(
    () => tokenFromHash(location.hash) ?? loadHostToken(code),
  );
  // A new pairing link opened in this tab changes only the hash, which doesn't remount the page.
  const [seenHash, setSeenHash] = useState(location.hash);
  if (location.hash !== seenHash) {
    setSeenHash(location.hash);
    const fromHash = tokenFromHash(location.hash);
    if (fromHash) setHostToken(fromHash);
  }

  // The token is in state now, so take it out of the address bar: it shouldn't linger in history or get shared.
  useEffect(() => {
    if (!location.hash) return;
    void navigate({ pathname: location.pathname, search: location.search }, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  // The token is stored only once the server accepts it, so a wrong link can't replace a good one.
  const onAccepted = useCallback((token: string) => saveHostToken(code, token), [code]);

  const onRejected = useCallback(
    (token: string) => {
      // A wrong or stale token (for example from an expired room with the same code) is dropped.
      // If it came from a link, any different stored token is still worth a try.
      if (loadHostToken(code) === token) clearHostToken(code);
      setHostToken(loadHostToken(code));
    },
    [code],
  );

  // Without a token this page never connects, so nothing secret can arrive.
  if (!hostToken) {
    return (
      <HostMessage
        title="Not authorised"
        detail="Open this page by scanning Pair host phone on the Screen."
      />
    );
  }
  // Keyed by token: a different token needs a fresh socket and join.
  return (
    <HostConnected
      key={hostToken}
      code={code}
      hostToken={hostToken}
      makeSocket={makeSocket}
      onAccepted={onAccepted}
      onRejected={onRejected}
    />
  );
}

interface HostConnectedProps {
  code: string;
  hostToken: string;
  makeSocket: () => GameSocket;
  onAccepted: (hostToken: string) => void;
  onRejected: (hostToken: string) => void;
}

function HostConnected({
  code,
  hostToken,
  makeSocket,
  onAccepted,
  onRejected,
}: HostConnectedProps) {
  const join = useCallback<JoinRoom>(
    (socket, ack) => {
      socket.emit('host:join', { code, hostToken }, (res) => {
        if (res.ok) onAccepted(hostToken);
        else if (res.error === INVALID_HOST_TOKEN_ERROR) return onRejected(hostToken);
        // A host holds a token for this room, so the room existed: it has ended (server restart).
        else if (res.error === ROOM_NOT_FOUND_ERROR) {
          return ack({ ok: false, error: GAME_ENDED_ERROR });
        }
        ack(res);
      });
    },
    [code, hostToken, onAccepted, onRejected],
  );
  const socketRef = useRoomSocket(code, join, makeSocket);
  const send = useSendHost(socketRef);

  const view = useRoomStore((state) => state.view);
  const error = useRoomStore((state) => state.error);

  if (error) return <HostMessage title={error} />;
  if (view?.role !== 'host') return <HostMessage title="Connecting…" link={false} />;
  return <HostRemote view={view} hostToken={hostToken} send={send} />;
}

interface HostRemoteProps {
  view: HostView;
  hostToken: string;
  send: SendHost;
}

const TABS = ['Game', 'Players', 'Settings'] as const;
type Tab = (typeof TABS)[number];

function HostRemote({ view, hostToken, send }: HostRemoteProps) {
  const { toast, show } = useToast();
  const [tab, setTab] = useState<Tab>('Game');
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const command = useHostCommand(view, send, show);
  // Above the tabs: the picker stays open over the lobby while the new set's images upload.
  const [pickingNewGame, setPickingNewGame] = useState(false);
  const closeNewGame = useCallback(() => setPickingNewGame(false), []);
  usePreloadImage(view.code, view.nextQuestion?.imageId);
  useVibrateOnTimeUp();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="font-display text-[22px] leading-tight text-accent">Host controls</h1>
          <p className="flex items-center gap-2 text-muted">
            <ConnectionDot />
            Room {view.code} · {view.players.length}{' '}
            {view.players.length === 1 ? 'player' : 'players'}
          </p>
          <p className="truncate text-sm text-muted">{view.title}</p>
        </div>
        {view.question && view.phase !== 'FINAL' && (
          <p
            aria-label={`Question ${view.questionIndex + 1} of ${view.questionCount}`}
            className={`${PILL} shrink-0 px-3 py-1 font-display text-lg tabular-nums`}
          >
            Q{view.questionIndex + 1}
            <span className="text-muted">/{view.questionCount}</span>
          </p>
        )}
      </header>
      <div
        role="tablist"
        aria-label="Remote"
        onKeyDown={(event) => {
          const next = tabForKey(tab, event.key);
          if (!next) return;
          event.preventDefault();
          setTab(next);
          tabRefs.current[next]?.focus();
        }}
        className="grid grid-cols-3 gap-1 rounded-2xl border-2 border-edge bg-surface p-1"
      >
        {TABS.map((name) => (
          <button
            key={name}
            ref={(button) => {
              tabRefs.current[name] = button;
            }}
            type="button"
            role="tab"
            id={`tab-${name}`}
            aria-selected={tab === name}
            tabIndex={tab === name ? 0 : -1}
            aria-controls={`panel-${name}`}
            onClick={() => setTab(name)}
            className={`min-h-11 rounded-xl px-2 py-2 text-lg ${tab === name ? 'bg-accent font-bold text-accent-ink' : 'text-muted'}`}
          >
            {name === 'Players' ? `Players (${view.players.length})` : name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="flex flex-col gap-5"
      >
        {tab === 'Game' && (
          <>
            {view.phase === 'FINAL' ? (
              <GameOverCard view={view} onNewGame={() => setPickingNewGame(true)} />
            ) : (
              <QuestionCard view={view} />
            )}
            <PrimaryAction view={view} command={command} />
            <SecondaryActions view={view} command={command} />
            {view.phase === 'LOBBY' && (
              <PairHostPhone
                code={view.code}
                hostToken={hostToken}
                className="self-start text-lg"
                dialogClassName="text-lg"
                qrSize="min(70vw, 20rem)"
              />
            )}
          </>
        )}
        {tab === 'Players' && <HostPlayers view={view} command={command} />}
        {tab === 'Settings' && <HostSettings view={view} command={command} />}
      </div>
      {pickingNewGame && (
        <NewGamePicker
          code={view.code}
          hostToken={hostToken}
          phase={view.phase}
          onClose={closeNewGame}
          onNotice={show}
          preview
        />
      )}
      <Toast toast={toast} />
    </main>
  );
}

/**
 * The WAI-ARIA tabs keys, with automatic activation (DECISIONS F40): ←/→ step and wrap, Home and
 * End jump to the ends. Null for any other key.
 */
function tabForKey(current: Tab, key: string): Tab | null {
  const i = TABS.indexOf(current);
  switch (key) {
    case 'ArrowRight':
      return TABS[(i + 1) % TABS.length]!;
    case 'ArrowLeft':
      return TABS[(i - 1 + TABS.length) % TABS.length]!;
    case 'Home':
      return TABS[0];
    case 'End':
      return TABS[TABS.length - 1]!;
    default:
      return null;
  }
}

/** How the host's phone buzzes when the answer time runs out: two pulses. */
const TIME_UP_VIBRATION = [200, 100, 200];

/**
 * Vibrates the remote on each `fx timeUp` (UI spec, Host remote). Only events after mount count,
 * so reconnecting or reopening the page never replays one. Where vibration is missing, nothing.
 */
function useVibrateOnTimeUp(): void {
  const event = useRoomStore((state) => state.fx);
  const handledSeq = useRef(event?.seq ?? 0);
  useEffect(() => {
    if (!event || event.seq <= handledSeq.current) return;
    handledSeq.current = event.seq;
    if (event.fx.kind === 'timeUp' && 'vibrate' in navigator) navigator.vibrate(TIME_UP_VIBRATION);
  }, [event]);
}

/**
 * The top of the remote: question number, text, the answer and notes box, and the image thumbnail
 * (UI spec, Host remote).
 */
function QuestionCard({ view }: { view: HostView }) {
  // In the lobby there is no current question yet, so show the first one the host will read out.
  const question = view.question ?? view.nextQuestion;
  const label = view.question
    ? `Question ${view.questionIndex + 1} of ${view.questionCount}`
    : `Up first: question 1 of ${view.questionCount}`;

  if (!question) return null;
  return (
    <section
      aria-label="Question"
      className="flex flex-col gap-3 rounded-[20px] border-2 border-edge bg-surface p-5"
    >
      <p className={`flex justify-between gap-2 ${LABEL}`}>
        <span>{label}</span>
        <span className="shrink-0 whitespace-nowrap">{question.points} pts</span>
      </p>
      {question.text && <p className="text-base font-bold">{question.text}</p>}
      {question.imageId && (
        <img
          src={imageUrl(view.code, question.imageId)}
          alt={question.text ? 'Question image' : 'Picture question'}
          className="max-h-48 self-center rounded-xl object-contain"
        />
      )}
      <div aria-label="Answer" className="rounded-xl bg-bg px-3.5 py-3">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className={LABEL}>Answer</span>
          <span className="font-display text-xl break-words text-accent">{question.answer}</span>
        </p>
        {question.hostNotes && <p className="mt-1.5 text-muted">{question.hostNotes}</p>}
      </div>
    </section>
  );
}

/**
 * The Game tab in FINAL: "Game over", the final ranking and **New game** (DECISIONS F50). The view
 * lists players in join order with each one's rank, so this orders by rank; tied players share it
 * and keep join order.
 */
function GameOverCard({ view, onNewGame }: { view: HostView; onNewGame: () => void }) {
  const ranked = [...view.players].sort((a, b) => a.rank - b.rank);
  return (
    <section aria-labelledby="game-over-heading" className={`flex flex-col gap-3 ${CARD}`}>
      <h2 id="game-over-heading" className="font-display text-3xl text-accent">
        Game over
      </h2>
      {ranked.length === 0 ? (
        <p className="text-muted">No players</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {ranked.map((player) => (
            <li
              key={player.id}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-lg ${
                player.rank === 1 ? 'bg-accent text-accent-ink' : 'bg-bg'
              }`}
            >
              <span
                className={`w-12 shrink-0 font-display ${player.rank === 1 ? '' : 'text-muted'}`}
              >
                {ordinal(player.rank)}
              </span>
              <span
                aria-hidden
                style={{ backgroundColor: player.color }}
                className="size-4 shrink-0 rounded-full"
              />
              <span className="min-w-0 flex-1 truncate font-bold">{player.name}</span>
              <span className="font-display text-xl">{player.score}</span>
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={onNewGame} className={`${BUTTON_PRIMARY} text-xl`}>
        New game
      </button>
    </section>
  );
}

function HostMessage({
  title,
  detail,
  link = true,
}: {
  title: string;
  detail?: string;
  link?: boolean;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <BulbRail count={9} variant="row" />
      <h1 className="font-display text-4xl">{title}</h1>
      {detail && <p className="text-lg text-muted">{detail}</p>}
      {link && (
        <Link to="/" className="py-2 text-lg text-muted underline underline-offset-4">
          Back to start
        </Link>
      )}
    </main>
  );
}

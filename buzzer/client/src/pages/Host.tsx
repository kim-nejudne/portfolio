import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { INVALID_HOST_TOKEN_ERROR } from '../../../shared/constants.js';
import type { HostView } from '../../../shared/types.js';
import { HostPlayers } from '../components/HostPlayers.js';
import { HostSettings } from '../components/HostSettings.js';
import { PairHostPhone } from '../components/PairHostPhone.js';
import { PrimaryAction } from '../components/PrimaryAction.js';
import { SecondaryActions } from '../components/SecondaryActions.js';
import { Toast, useToast } from '../components/Toast.js';
import { imageUrl } from '../lib/api.js';
import { clearHostToken, loadHostToken, saveHostToken, tokenFromHash } from '../lib/hostTokens.js';
import { isCompleteRoomCode } from '../lib/roomCode.js';
import { useRoomStore } from '../lib/roomStore.js';
import { createSocket, type GameSocket } from '../lib/socket.js';
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
  const command = useHostCommand(view, send, show);
  usePreloadImage(view.code, view.nextQuestion?.imageId);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-5">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl tracking-[0.15em] text-accent">{view.code}</h1>
        <p className="truncate text-muted">{view.title}</p>
      </header>
      <div
        role="tablist"
        aria-label="Remote"
        className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1"
      >
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`tab-${name}`}
            aria-selected={tab === name}
            aria-controls={`panel-${name}`}
            onClick={() => setTab(name)}
            className={`rounded-xl px-2 py-2 text-lg ${tab === name ? 'bg-edge text-ink' : 'text-muted'}`}
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
            <QuestionCard view={view} />
            <PrimaryAction view={view} command={command} />
            <SecondaryActions view={view} command={command} />
            {view.phase === 'LOBBY' && (
              <PairHostPhone
                code={view.code}
                hostToken={hostToken}
                className="text-lg"
                qrSize="200px"
              />
            )}
          </>
        )}
        {tab === 'Players' && <HostPlayers view={view} command={command} />}
        {tab === 'Settings' && <HostSettings view={view} command={command} />}
      </div>
      <Toast toast={toast} />
    </main>
  );
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
      className="flex flex-col gap-3 rounded-3xl border-2 border-edge bg-surface p-4"
    >
      <p className="flex justify-between text-sm text-muted">
        <span>{label}</span>
        <span>{question.points} pts</span>
      </p>
      {question.text && <p className="text-xl">{question.text}</p>}
      {question.imageId && (
        <img
          src={imageUrl(view.code, question.imageId)}
          alt={question.text ? 'Question image' : 'Picture question'}
          className="max-h-48 self-center rounded-xl object-contain"
        />
      )}
      <div aria-label="Answer" className="rounded-2xl bg-accent p-3 text-accent-ink">
        <p className="text-sm font-bold tracking-wide uppercase">Answer</p>
        <p className="font-display text-2xl">{question.answer}</p>
        {question.hostNotes && <p className="mt-2 text-base">{question.hostNotes}</p>}
      </div>
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
      <h1 className="font-display text-4xl">{title}</h1>
      {detail && <p className="text-lg text-muted">{detail}</p>}
      {link && (
        <Link to="/" className="text-lg underline underline-offset-4">
          Back to start
        </Link>
      )}
    </main>
  );
}

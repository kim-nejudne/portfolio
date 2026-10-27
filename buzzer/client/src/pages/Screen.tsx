import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { INVALID_HOST_TOKEN_ERROR } from '../../../shared/constants.js';
import type { RankedPlayer, ScreenView } from '../../../shared/types.js';
import { PairHostPhone } from '../components/PairHostPhone.js';
import { ScreenHostControls } from '../components/ScreenHostControls.js';
import { ScreenFlash } from '../components/ScreenFlash.js';
import { ScreenQuestion } from '../components/ScreenQuestion.js';
import { FinalResults, Scoreboard } from '../components/ScreenResults.js';
import { clearHostToken, loadHostToken } from '../lib/hostTokens.js';
import { displayUrl, isLoopbackHost, joinUrl } from '../lib/joinUrl.js';
import { isCompleteRoomCode } from '../lib/roomCode.js';
import { useRoomStore } from '../lib/roomStore.js';
import { createSocket, type GameSocket } from '../lib/socket.js';
import { useSendHost } from '../lib/useHostCommand.js';
import { usePreloadImage } from '../lib/usePreloadImage.js';
import { useRoomSocket, type JoinRoom } from '../lib/useRoomSocket.js';

interface ScreenProps {
  /** Tests pass a fake socket. */
  makeSocket?: () => GameSocket;
}

/** The big display at `/screen/:code`, designed for 1920×1080 and sized in viewport units. */
export function Screen({ makeSocket = createSocket }: ScreenProps) {
  const code = (useParams().code ?? '').toUpperCase();
  if (!isCompleteRoomCode(code)) return <ScreenMessage title="Room not found" />;
  return <ScreenRoom code={code} makeSocket={makeSocket} />;
}

function ScreenRoom({ code, makeSocket }: { code: string; makeSocket: () => GameSocket }) {
  // True once the server accepted this device's hostToken: only then does it get host controls.
  const [canHost, setCanHost] = useState(false);
  const join = useCallback<JoinRoom>(
    (socket, ack) => {
      // A device that created the room joins with its token, so it may send host actions (DECISIONS #2).
      const hostToken = loadHostToken(code);
      if (!hostToken) {
        setCanHost(false);
        return socket.emit('screen:join', { code }, ack);
      }
      socket.emit('screen:join', { code, hostToken }, (res) => {
        // SPEC-QUESTION: a rejected token can only be stale (a reused code), so join as a plain Screen (DECISIONS, F08).
        if (!res.ok && res.error === INVALID_HOST_TOKEN_ERROR) {
          clearHostToken(code);
          setCanHost(false);
          return socket.emit('screen:join', { code }, ack);
        }
        setCanHost(res.ok);
        ack(res);
      });
    },
    [code],
  );
  const socketRef = useRoomSocket(code, join, makeSocket);
  const send = useSendHost(socketRef);
  // The order the scoreboard last showed, so the next showing can replay the climb.
  const [scoreboardOrder, setScoreboardOrder] = useState<string[]>([]);

  const view = useRoomStore((state) => state.view);
  const error = useRoomStore((state) => state.error);
  usePreloadImage(code, view?.role === 'screen' ? view.nextImageId : null);
  // SPEC-QUESTION: the join URL uses the Screen page's own origin; there is no configured public URL (DECISIONS, F08).
  const url = joinUrl(window.location.origin, code);

  if (error) return <ScreenMessage title={error} />;
  if (view?.role !== 'screen') return <ScreenMessage title="Connecting…" link={false} />;

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-bg">
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* With host controls, the content stops above the bar, so it never hides the reveal or the podium. */}
        <div className={`relative flex min-h-0 flex-1 flex-col ${canHost ? 'mb-[8vh]' : ''}`}>
          {view.phase === 'LOBBY' ? (
            <Lobby view={view} url={url} hostToken={loadHostToken(code)} />
          ) : view.phase === 'FINAL' ? (
            <FinalResults players={view.players} />
          ) : (
            <ScreenQuestion view={view} />
          )}
          {/* SPEC-QUESTION: the Final screen already ranks everyone, so the overlay never covers it (DECISIONS, F24). */}
          {view.showScoreboard && view.phase !== 'FINAL' && (
            <Scoreboard
              players={view.players}
              lastOrder={scoreboardOrder}
              onShown={setScoreboardOrder}
            />
          )}
        </div>
        <ScreenFlash />
        {/* Last, so the bar stays above the scoreboard and the flash. */}
        {canHost && <ScreenHostControls view={view} send={send} />}
      </div>
      <BottomStrip code={code} url={url} />
    </main>
  );
}

interface LobbyProps {
  view: ScreenView;
  url: string;
  /** Set when this device created the room, so it may pair host phones (DECISIONS #14). */
  hostToken: string | null;
}

function Lobby({ view, url, hostToken }: LobbyProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[3vh] px-[5vw] pt-[5vh]">
      <div className="flex items-center justify-between gap-[4vw]">
        <div className="flex min-w-0 flex-col gap-[1vh]">
          <p className="text-[2.2vw] text-muted">{view.title}</p>
          <p className="text-[2.6vw]">Join at</p>
          <p className="font-display text-[3.2vw] break-all text-accent">{displayUrl(url)}</p>
          <p className="mt-[2vh] text-[2.2vw] text-muted">Room code</p>
          <h1 className="font-display text-[clamp(4rem,15vw,32vh)] leading-none tracking-[0.12em]">
            {view.code}
          </h1>
          {isLoopbackHost(window.location.hostname) && (
            <p role="note" className="text-[1.6vw] text-muted">
              Phones can’t open localhost. Open this page at this computer’s network address
              instead.
            </p>
          )}
          {hostToken && (
            <PairHostPhone
              code={view.code}
              hostToken={hostToken}
              className="mt-[2vh] text-[1.6vw]"
              qrSize="22vh"
            />
          )}
        </div>
        <div className="shrink-0 rounded-[2vh] bg-white p-[2vh]">
          <QRCodeSVG
            value={url}
            title={`Join at ${url}`}
            marginSize={0}
            style={{ width: '36vh', height: '36vh' }}
          />
        </div>
      </div>
      <PlayerChips players={view.players} />
    </div>
  );
}

function PlayerChips({ players }: { players: RankedPlayer[] }) {
  if (players.length === 0) {
    return <p className="text-[2.4vw] text-muted">Waiting for players…</p>;
  }
  // Smaller chips past 20 players, so a full room of 50 still fits above the bottom strip.
  const chipText = players.length > 20 ? 'text-[1.4vw]' : 'text-[2.2vw]';
  return (
    <section aria-label="Players" className="flex min-h-0 flex-col gap-[2vh]">
      <p className="text-[2.2vw] text-muted">
        {players.length} {players.length === 1 ? 'player' : 'players'}
      </p>
      <ul className="flex flex-wrap content-start gap-[1.2vw] overflow-hidden">
        {players.map((player) => (
          <li
            key={player.id}
            style={{ backgroundColor: player.color }}
            className={`rounded-full px-[1.6vw] py-[0.8vh] font-display text-bg motion-safe:animate-pop-in ${chipText} ${player.connected ? '' : 'opacity-40'}`}
          >
            {player.name}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Always on screen, so late joiners can get in (UI spec, Screen view). */
function BottomStrip({ code, url }: { code: string; url: string }) {
  return (
    <footer className="flex shrink-0 items-center justify-between gap-[2vw] border-t-2 border-edge bg-surface px-[3vw] py-[1.4vh] text-[1.8vw]">
      <p>
        Room <span className="font-display tracking-[0.15em] text-accent">{code}</span>
      </p>
      <p>
        Join at <span className="font-display text-accent">{displayUrl(url)}</span>
      </p>
    </footer>
  );
}

function ScreenMessage({ title, link = true }: { title: string; link?: boolean }) {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-[4vh] bg-bg px-4 text-center">
      <h1 className="font-display text-[clamp(2rem,5vw,10vh)]">{title}</h1>
      {link && (
        <Link to="/" className="text-[clamp(1rem,2vw,4vh)] underline underline-offset-4">
          Back to start
        </Link>
      )}
    </main>
  );
}

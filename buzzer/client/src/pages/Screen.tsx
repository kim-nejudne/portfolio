import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  GAME_ENDED_ERROR,
  INVALID_HOST_TOKEN_ERROR,
  ROOM_NOT_FOUND_ERROR,
} from '../../../shared/constants.js';
import type { Phase, RankedPlayer, ScreenView } from '../../../shared/types.js';
import { HostSettings } from '../components/HostSettings.js';
import { Icon } from '../components/Icon.js';
import { PairHostPhone } from '../components/PairHostPhone.js';
import { ReconnectingBanner } from '../components/ReconnectingBanner.js';
import { ScreenHeader, ScreenRail } from '../components/ScreenChrome.js';
import { ScreenHostControls } from '../components/ScreenHostControls.js';
import { ScreenFlash } from '../components/ScreenFlash.js';
import { ScreenQuestion } from '../components/ScreenQuestion.js';
import { FinalResults, Scoreboard } from '../components/ScreenResults.js';
import { StartOverlay } from '../components/StartOverlay.js';
import { Toast, useToast } from '../components/Toast.js';
import { enterFullscreen } from '../lib/fullscreen.js';
import { clearHostToken, loadHostToken } from '../lib/hostTokens.js';
import { displayUrl, isLoopbackHost, joinPageOrigin, joinUrl } from '../lib/joinUrl.js';
import { isCompleteRoomCode } from '../lib/roomCode.js';
import { useRoomStore } from '../lib/roomStore.js';
import { createSocket, type GameSocket } from '../lib/socket.js';
import { preloadSounds, startSounds } from '../lib/sounds.js';
import {
  useHostCommand,
  useSendHost,
  type HostCommand,
  type SendHost,
} from '../lib/useHostCommand.js';
import { useJoinOrigin } from '../lib/useJoinOrigin.js';
import { usePreloadImage } from '../lib/usePreloadImage.js';
import { useRoomSocket, type JoinRoom } from '../lib/useRoomSocket.js';
import { useScreenSounds } from '../lib/useScreenSounds.js';
import { BUTTON_PRIMARY } from '../lib/ui.js';
import { useShrinkToFit } from '../lib/useShrinkToFit.js';

interface ScreenProps {
  /** Tests pass a fake socket. */
  makeSocket?: () => GameSocket;
}

/** The big display at `/screen/:code`, designed for 1920×1080 and sized in viewport units. */
export function Screen({ makeSocket = createSocket }: ScreenProps) {
  const code = (useParams().code ?? '').toUpperCase();
  if (!isCompleteRoomCode(code)) return <ScreenMessage title="Room not found" />;
  return <StartedScreenRoom code={code} makeSocket={makeSocket} />;
}

interface RoomProps {
  code: string;
  makeSocket: () => GameSocket;
}

/** The room behind the Click to start overlay, which unlocks audio and enters fullscreen. */
function StartedScreenRoom(props: RoomProps) {
  const [started, setStarted] = useState(false);
  useEffect(preloadSounds, []);
  const error = useRoomStore((state) => state.error);
  const phase = useRoomStore((state) => (state.view?.role === 'screen' ? state.view.phase : null));
  const start = () => {
    // Fullscreen first: it needs the gesture, and loading the sounds may wait on the network.
    enterFullscreen();
    void startSounds();
    setStarted(true);
  };
  return (
    <>
      <ScreenRoom {...props} />
      {started && <ScreenSounds phase={phase} />}
      {!started && !error && <StartOverlay onStart={start} />}
    </>
  );
}

function ScreenSounds({ phase }: { phase: Phase | null }) {
  useScreenSounds(phase);
  return null;
}

function ScreenRoom({ code, makeSocket }: RoomProps) {
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
        // A stored token means this device created the room, so a missing room has ended (server restart).
        if (!res.ok && res.error === ROOM_NOT_FOUND_ERROR) {
          return ack({ ok: false, error: GAME_ENDED_ERROR });
        }
        ack(res);
      });
    },
    [code],
  );
  const socketRef = useRoomSocket(code, join, makeSocket);
  const send = useSendHost(socketRef);

  const view = useRoomStore((state) => state.view);
  const error = useRoomStore((state) => state.error);
  usePreloadImage(code, view?.role === 'screen' ? view.nextImageId : null);

  if (error) return <ScreenMessage title={error} />;
  if (view?.role !== 'screen') return <ScreenMessage title="Connecting…" link={false} />;
  return <ScreenStage view={view} canHost={canHost} send={send} />;
}

interface StageProps {
  view: ScreenView;
  canHost: boolean;
  send: SendHost;
}

function ScreenStage({ view, canHost, send }: StageProps) {
  const { code } = view;
  // One lock and one toast for the bar, the shortcuts and the lobby's settings (F37).
  const { toast, show } = useToast();
  const command = useHostCommand(view, send, show);
  // The order the scoreboard last showed, so the next showing can replay the climb.
  const [scoreboardOrder, setScoreboardOrder] = useState<string[]>([]);
  // PUBLIC_URL, or this machine's LAN address on localhost, else the page's own origin (DECISIONS F42).
  const joinOrigin = useJoinOrigin();
  const url = joinUrl(joinPageOrigin(joinOrigin ?? null, window.location), code);
  // Only once the server has answered that it has no address phones can reach.
  const unreachable = joinOrigin === null && isLoopbackHost(window.location.hostname);

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-bg">
      <ScreenRail />
      <ScreenHeader
        code={code}
        questionIndex={view.questionIndex}
        questionCount={view.questionCount}
        numbered={view.question !== null && view.phase !== 'FINAL'}
        url={url}
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* With host controls, the content stops above the bar, so it never hides the reveal or the podium. */}
        <div className={`relative flex min-h-0 flex-1 flex-col ${canHost ? 'mb-[8vh]' : ''}`}>
          {view.phase === 'LOBBY' ? (
            <Lobby
              view={view}
              url={url}
              unreachable={unreachable}
              hostToken={loadHostToken(code)}
              command={canHost ? command : null}
            />
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
        {canHost && <ScreenHostControls view={view} command={command} />}
      </div>
      <ScreenRail />
      <Toast toast={toast} />
      <ReconnectingBanner />
    </main>
  );
}

/** Past this many players, the lobby makes room for more chips. */
const MANY_PLAYERS = 20;
/** Chip text as a share of the lobby column's width: 2.44 cqw and 1.56 cqw before F38. */
const CHIP_MAX_FEW = 0.0244;
const CHIP_MAX_MANY = 0.0156;
/** Only long names in a full room at 1280×720 beside Game setup come near it (F38). */
const CHIP_MIN_PX = 8;

interface LobbyProps {
  view: ScreenView;
  url: string;
  /** True when phones cannot open `url`: the page is on localhost and the server knows no LAN address. */
  unreachable: boolean;
  /** Set when this device created the room, so it may pair host phones (DECISIONS #14). */
  hostToken: string | null;
  /** Set when the server accepted this device's hostToken: the lobby then offers Start and the settings. */
  command: HostCommand | null;
}

function Lobby({ view, url, unreachable, hostToken, command }: LobbyProps) {
  // A full room gives the chips more height: a smaller (still huge) code and join QR.
  const many = view.players.length > MANY_PLAYERS;
  const qrSize = many ? 'min(30vh, 22cqw)' : 'min(36vh, 28cqw)';
  return (
    <div className="flex min-h-0 flex-1 gap-[3vw] px-[3.75vw] pt-[2vh] pb-[3vh]">
      {/* A size container: without the panel it is 90vw wide, so N vw is written N / 0.9 cqw and
          nothing changes; beside the panel everything shrinks with it instead of wrapping. */}
      <div className="@container flex min-w-0 flex-1 flex-col gap-[3vh]">
        <div className="flex items-center justify-between gap-[4.44cqw]">
          <div className="flex min-w-0 flex-col gap-[1vh]">
            <p className="text-[1.6cqw] font-bold tracking-[0.25em] text-muted uppercase">
              {view.title}
            </p>
            <p className="text-[2.89cqw]">Join at</p>
            <p className="font-display text-[3.56cqw] break-all text-accent">{displayUrl(url)}</p>
            <p className="mt-[2vh] text-[1.6cqw] font-bold tracking-[0.25em] text-muted uppercase">
              Room code
            </p>
            <h1
              className={`font-display ${many ? 'text-[clamp(3rem,12cqw,24vh)]' : 'text-[clamp(4rem,16.67cqw,32vh)]'} leading-none tracking-[0.12em] text-accent [text-shadow:0.4cqw_0.4cqw_0_var(--color-bg-deep)]`}
            >
              {view.code}
            </h1>
            {unreachable && (
              <p role="note" className="text-[1.78cqw] text-muted">
                Phones can’t open localhost. Open this page at this computer’s network address
                instead.
              </p>
            )}
          </div>
          {/* Pair host phone sits under the join QR, where the column has height to spare (F38). */}
          <div className="flex shrink-0 flex-col items-center gap-[2vh]">
            {/* White behind the QR, so every phone camera reads it, inside the gold stage ring. */}
            <div className="rounded-[2vh] bg-white p-[2vh] shadow-[0_0_0_0.47vw_var(--color-bg),0_0_0_0.78vw_var(--color-accent)]">
              <QRCodeSVG
                value={url}
                title={`Join at ${url}`}
                marginSize={0}
                style={{ width: qrSize, height: qrSize }}
              />
            </div>
            {hostToken && (
              <PairHostPhone
                code={view.code}
                hostToken={hostToken}
                className="text-[1.78cqw]"
                dialogClassName="text-[clamp(1rem,1.8vw,3.2vh)]"
                qrSize="min(58vh, 45vw)"
              />
            )}
          </div>
        </div>
        <PlayerChips players={view.players} />
      </div>
      {command && <LobbyHostPanel view={view} command={command} />}
    </div>
  );
}

/** Start game beside the room settings, for a host with no paired phone (F37). */
function LobbyHostPanel({ view, command }: { view: ScreenView; command: HostCommand }) {
  return (
    <aside
      aria-label="Game setup"
      // Sized in rem for a laptop Screen; doubled on a 4K-wide viewport so it stays readable.
      className="flex w-[min(28rem,30vw)] shrink-0 flex-col gap-3 overflow-y-auto min-[2560px]:[zoom:2]"
    >
      <button
        type="button"
        onClick={() => command.run('host:start', {})}
        disabled={command.busy}
        aria-keyshortcuts="Space"
        className={`${BUTTON_PRIMARY} flex items-center justify-center gap-3 text-2xl`}
      >
        Start game <Icon name="arrow-right" className="size-7" />
        <kbd aria-hidden className="ml-2 font-mono text-base opacity-70">
          Space
        </kbd>
      </button>
      <HostSettings view={view} command={command} compact />
    </aside>
  );
}

function PlayerChips({ players }: { players: RankedPlayer[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  // Smaller chips past 20 players, and smaller still if the room's names would not fit: nobody can
  // scroll a TV, so every chip must stay above the bottom strip (F38).
  useShrinkToFit(
    listRef,
    players.length > MANY_PLAYERS ? CHIP_MAX_MANY : CHIP_MAX_FEW,
    CHIP_MIN_PX,
    players.map((player) => player.name).join('\n'),
  );
  if (players.length === 0) {
    return <p className="text-[2.67cqw] text-muted">Waiting for players…</p>;
  }
  return (
    <section aria-label="Players" className="flex min-h-0 flex-1 flex-col gap-[2vh]">
      <p className="text-[1.6cqw] font-bold tracking-[0.25em] text-muted uppercase">
        {players.length} {players.length === 1 ? 'player' : 'players'}
      </p>
      <ul
        ref={listRef}
        className="flex min-h-0 flex-1 flex-wrap content-start gap-[0.45em] overflow-hidden"
      >
        {players.map((player) => (
          <li
            key={player.id}
            style={{ backgroundColor: player.color }}
            className={`rounded-full px-[0.73em] py-[0.25em] font-display text-bg motion-safe:animate-pop-in ${player.connected ? '' : 'opacity-40'}`}
          >
            {player.name}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScreenMessage({ title, link = true }: { title: string; link?: boolean }) {
  return (
    <main className="flex h-dvh flex-col bg-bg text-center">
      <ScreenRail />
      <div className="flex flex-1 flex-col items-center justify-center gap-[4vh] px-4">
        <h1 className="font-display text-[clamp(2rem,5vw,10vh)]">{title}</h1>
        {link && (
          <Link
            to="/"
            className="text-[clamp(1rem,2vw,4vh)] text-muted underline underline-offset-4 hover:text-ink"
          >
            Back to start
          </Link>
        )}
      </div>
      <ScreenRail />
    </main>
  );
}

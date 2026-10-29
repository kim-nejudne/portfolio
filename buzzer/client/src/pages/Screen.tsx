import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  GAME_ENDED_ERROR,
  INVALID_HOST_TOKEN_ERROR,
  ROOM_NOT_FOUND_ERROR,
  TITLE_CARD_MS,
} from '../../../shared/constants.js';
import type {
  BoardView,
  Phase,
  RankedPlayer,
  ScreenView,
  TeamView,
} from '../../../shared/types.js';
import { HostSettings } from '../components/HostSettings.js';
import { NewGamePicker } from '../components/NewGamePicker.js';
import { PlayerAvatar } from '../components/PlayerAvatar.js';
import { Icon } from '../components/Icon.js';
import { PairHostPhone } from '../components/PairHostPhone.js';
import { ReconnectingBanner } from '../components/ReconnectingBanner.js';
import { ScreenHeader, ScreenRail } from '../components/ScreenChrome.js';
import { ScreenBoard } from '../components/ScreenBoard.js';
import { ScreenHostControls } from '../components/ScreenHostControls.js';
import { ScreenFlash } from '../components/ScreenFlash.js';
import { ScreenQuestion } from '../components/ScreenQuestion.js';
import { FinalResults, Scoreboard } from '../components/ScreenResults.js';
import { StartOverlay } from '../components/StartOverlay.js';
import { Toast, useToast } from '../components/Toast.js';
import { firstUnused, tileOf, type BoardCursor } from '../lib/boardCursor.js';
import { enterFullscreen } from '../lib/fullscreen.js';
import { clearHostToken, loadHostToken } from '../lib/hostTokens.js';
import { HOVER } from '../lib/hover.js';
import { DIFFICULTY_LABELS } from '../lib/setLabels.js';
import { displayUrl, isLoopbackHost, joinPageOrigin, joinUrl } from '../lib/joinUrl.js';
import { isCompleteRoomCode } from '../lib/roomCode.js';
import { useRoomStore } from '../lib/roomStore.js';
import { createSocket, type GameSocket } from '../lib/socket.js';
import { cycleSoundLevel, preloadSounds, SOUND_LEVEL_LABEL, startSounds } from '../lib/sounds.js';
import {
  useHostCommand,
  useSendHost,
  type HostCommand,
  type SendHost,
} from '../lib/useHostCommand.js';
import { useJoinOrigin } from '../lib/useJoinOrigin.js';
import { usePreloadImage } from '../lib/usePreloadImage.js';
import { useRoomSocket, type JoinRoom } from '../lib/useRoomSocket.js';
import { usePracticePops } from '../lib/usePracticePops.js';
import { useScreenSounds } from '../lib/useScreenSounds.js';
import { useSoundLevel } from '../lib/useSoundLevel.js';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../lib/ui.js';
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
  // Above the phase switch: the picker stays open over the lobby while the new set's images upload.
  const [pickingNewGame, setPickingNewGame] = useState(false);
  const closeNewGame = useCallback(() => setPickingNewGame(false), []);
  const hostToken = canHost ? loadHostToken(code) : null;
  // The host bar handles `M` with the other shortcuts; a token-less Screen has only this key.
  useSoundKey(!canHost);
  const titleCard = useTitleCard(view.phase, view.questionIndex);
  const [cursor, setCursor] = useBoardCursor(view.phase, view.board);
  const zoomFrom = useTileZoom(view.phase, view.questionIndex, view.board);
  // On a board set, the header names the tile instead of the set-order number (F90).
  const tile = tileOf(view.board, view.questionIndex);

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-bg">
      <ScreenRail />
      <ScreenHeader
        code={code}
        questionIndex={view.questionIndex}
        questionCount={view.questionCount}
        numbered={view.question !== null && view.phase !== 'FINAL'}
        tileLabel={tile ? `${tile.title} · ${tile.points}` : undefined}
        gameNumber={view.session?.gameNumber}
        // The lobby's body shows the join address with its QR, so the header leaves it out (F66).
        url={view.phase === 'LOBBY' ? undefined : url}
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
            <FinalResults players={view.players} session={view.session} teams={view.teams} />
          ) : titleCard ? (
            <TitleCard view={view} />
          ) : view.phase === 'BOARD' && view.board ? (
            <ScreenBoard
              board={view.board}
              cursor={canHost ? cursor : undefined}
              onPick={
                canHost ? (questionIndex) => command.run('host:pick', { questionIndex }) : undefined
              }
              busy={command.busy}
            />
          ) : zoomFrom ? (
            // Keyed by question, so the zoom plays once as the picked tile opens (F90).
            <div
              key={view.questionIndex}
              style={{ transformOrigin: zoomFrom }}
              data-tile-zoom
              className="flex min-h-0 flex-1 flex-col motion-safe:animate-tile-zoom"
            >
              <ScreenQuestion view={view} />
            </div>
          ) : (
            <ScreenQuestion view={view} />
          )}
          {/* SPEC-QUESTION: the Final screen already ranks everyone, so the overlay never covers it (DECISIONS, F24). */}
          {view.showScoreboard && view.phase !== 'FINAL' && (
            <Scoreboard
              players={view.players}
              lastOrder={scoreboardOrder}
              onShown={setScoreboardOrder}
              teams={view.teams}
            />
          )}
        </div>
        <ScreenFlash />
        {/* Last, so the bar stays above the scoreboard and the flash. Off under the picker, so no
            shortcut (Space: Start game) acts while the new set's images upload. */}
        {canHost && !pickingNewGame && (
          <ScreenHostControls
            view={view}
            command={command}
            boardCursor={cursor}
            onBoardCursor={setCursor}
            onNewGame={() => setPickingNewGame(true)}
          />
        )}
      </div>
      <ScreenRail />
      {pickingNewGame && hostToken && (
        <NewGamePicker
          code={code}
          hostToken={hostToken}
          phase={view.phase}
          onClose={closeNewGame}
          onNotice={show}
          // Sized in rem for a laptop Screen, like the lobby's Game setup; doubled on a 4K viewport.
          className="min-[2560px]:[zoom:2]"
        />
      )}
      <Toast toast={toast} />
      <ReconnectingBanner />
    </main>
  );
}

/**
 * True for `TITLE_CARD_MS` after the room leaves the lobby for question 1, while the buzzers stay
 * locked: opening them early ends it. On a board set it shows over the board until the first pick
 * (F90). A Screen that loads mid-game never shows it (F66).
 */
function useTitleCard(phase: Phase, questionIndex: number): boolean {
  const [shown, setShown] = useState(false);
  // The phase of the last render, so the move out of the lobby is caught while rendering.
  const [previous, setPrevious] = useState(phase);
  if (phase !== previous) {
    setPrevious(phase);
    setShown(
      previous === 'LOBBY' && ((phase === 'QUESTION' && questionIndex === 0) || phase === 'BOARD'),
    );
  }
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(false), TITLE_CARD_MS);
    return () => clearTimeout(timer);
  }, [shown]);
  return shown;
}

/**
 * The host's place on the board for the arrow keys. It goes to the first unplayed tile each time
 * the room comes back to the board, so the tile just played is never under it (F90).
 */
function useBoardCursor(
  phase: Phase,
  board: BoardView | null,
): [BoardCursor, (cursor: BoardCursor) => void] {
  const [cursor, setCursor] = useState<BoardCursor>(() =>
    board ? firstUnused(board) : { column: 0, row: 0 },
  );
  const [previous, setPrevious] = useState(phase);
  if (phase !== previous) {
    setPrevious(phase);
    if (phase === 'BOARD' && board) setCursor(firstUnused(board));
  }
  return [cursor, setCursor];
}

/**
 * When the room moves from the board into a question, the picked tile's place on the board as a
 * CSS transform origin, so the question grows out of it; null otherwise. It holds for the whole
 * question, so the zoom is not cut short by the buzzers opening (F90).
 */
function useTileZoom(phase: Phase, questionIndex: number, board: BoardView | null): string | null {
  const [zoom, setZoom] = useState<{ questionIndex: number; origin: string } | null>(null);
  const [previous, setPrevious] = useState(phase);
  if (phase !== previous) {
    setPrevious(phase);
    const column = board?.columns.findIndex((c) =>
      c.tiles.some((t) => t.questionIndex === questionIndex),
    );
    if (previous === 'BOARD' && board && column !== undefined && column !== -1) {
      const row = board.columns[column]!.tiles.findIndex((t) => t.questionIndex === questionIndex);
      const x = ((column + 0.5) / board.columns.length) * 100;
      const y = ((row + 1.5) / (board.columns[column]!.tiles.length + 1)) * 100;
      setZoom({ questionIndex, origin: `${x}% ${y}%` });
    }
  }
  return zoom?.questionIndex === questionIndex ? zoom.origin : null;
}

/** The set's title, category and difficulty before question 1 (UI spec, Screen view: Title card). */
function TitleCard({ view }: { view: ScreenView }) {
  const details = [view.category, view.difficulty && DIFFICULTY_LABELS[view.difficulty]].filter(
    Boolean,
  );
  return (
    <section
      aria-label="Title card"
      className="flex flex-1 flex-col items-center justify-center gap-[4vh] px-[6vw] text-center motion-safe:animate-pop-in"
    >
      <p className="text-[min(1.8vw,3.2vh)] font-bold tracking-[0.25em] text-muted uppercase">
        Get ready
      </p>
      <h1 className="font-display text-[min(6vw,12vh)] leading-tight text-balance break-words text-accent [text-shadow:0.4vw_0.4vw_0_var(--color-bg-deep)]">
        {view.title}
      </h1>
      {details.length > 0 && (
        <p className="font-display text-[min(3vw,5.5vh)] text-ink">{details.join(' · ')}</p>
      )}
    </section>
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
            {/* A token-less Screen has no host bar, so its sound button lives here (F62). */}
            {!command && <SoundButton />}
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
        <PlayerChips players={view.players} teams={view.teams} />
      </div>
      {command && <LobbyHostPanel view={view} command={command} />}
    </div>
  );
}

/**
 * Start game beside the room settings, for a host with no paired phone (F37). With a host phone
 * paired, the settings fold behind a Settings button: the remote has them too (F66).
 */
function LobbyHostPanel({ view, command }: { view: ScreenView; command: HostCommand }) {
  const folded = view.hostDevices > 0;
  const [open, setOpen] = useState(false);
  const settingsId = useId();
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
        className={`${BUTTON_PRIMARY} flex items-center justify-center gap-3 text-2xl ${HOVER}`}
      >
        Start game <Icon name="arrow-right" className="size-7" />
        <kbd aria-hidden className="ml-2 font-mono text-base opacity-70">
          Space
        </kbd>
      </button>
      {folded && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={settingsId}
          onClick={() => setOpen((o) => !o)}
          className={`${BUTTON_SECONDARY} font-display text-xl ${HOVER}`}
        >
          Settings
          <span aria-hidden className={`ml-2 inline-block transition ${open ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
      )}
      {(!folded || open) && (
        <div id={settingsId}>
          <HostSettings view={view} command={command} compact />
        </div>
      )}
    </aside>
  );
}

/**
 * The joined players as coloured chips. With teams on, one column per team in index order, each
 * headed by the team's name in its colour, its members in join order (F82).
 */
function PlayerChips({ players, teams }: { players: RankedPlayer[]; teams: TeamView[] | null }) {
  // The box the chips must fit: the one list, or every team's column.
  const listRef = useRef<HTMLDivElement>(null);
  const pops = usePracticePops();
  // Smaller chips past 20 players, and smaller still if the room's names would not fit: nobody can
  // scroll a TV, so every chip must stay above the bottom strip (F38). A move between teams
  // changes the columns' heights, so the teams are part of what it fits.
  useShrinkToFit(
    listRef,
    players.length > MANY_PLAYERS ? CHIP_MAX_MANY : CHIP_MAX_FEW,
    CHIP_MIN_PX,
    players.map((player) => `${player.avatar ?? ''}${player.name}`).join('\n') +
      (teams ? `\n${teams.map((team) => team.memberIds.join(',')).join('|')}` : ''),
  );
  if (players.length === 0 && !teams) {
    return <p className="text-[2.67cqw] text-muted">Waiting for players…</p>;
  }
  const chip = (player: RankedPlayer) => {
    // A test buzz remounts the chip under a new key, so its bump replays (F60).
    const pop = pops.get(player.id);
    return (
      <PlayerChip
        key={pop === undefined ? player.id : `${player.id}:${pop}`}
        player={player}
        pop={pop}
      />
    );
  };
  const byId = new Map(players.map((player) => [player.id, player]));
  return (
    <section aria-label="Players" className="flex min-h-0 flex-1 flex-col gap-[2vh]">
      <p className="text-[1.6cqw] font-bold tracking-[0.25em] text-muted uppercase">
        {players.length} {players.length === 1 ? 'player' : 'players'}
      </p>
      <div ref={listRef} className="min-h-0 flex-1 overflow-hidden">
        {teams ? (
          <div
            style={{ gridTemplateColumns: `repeat(${teams.length}, minmax(0, 1fr))` }}
            className="grid content-start gap-[1em]"
          >
            {teams.map((team) => {
              const members = team.memberIds.flatMap((id) => byId.get(id) ?? []);
              return (
                <section
                  key={team.index}
                  aria-label={`${team.name} team`}
                  style={{ borderColor: team.color }}
                  className="flex min-w-0 flex-col gap-[0.45em] border-t-[0.2em] pt-[0.4em]"
                >
                  <h2 className="flex items-baseline justify-between gap-[0.5em] font-display">
                    <span style={{ color: team.color }} className="truncate">
                      {team.name}
                    </span>
                    <span className="shrink-0 text-[0.7em] text-muted tabular-nums">
                      {members.length}
                    </span>
                  </h2>
                  {members.length === 0 ? (
                    <p className="text-[0.7em] text-muted">No players yet</p>
                  ) : (
                    <ul className="flex flex-wrap content-start gap-[0.45em]">
                      {members.map(chip)}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <ul className="flex flex-wrap content-start gap-[0.45em]">{players.map(chip)}</ul>
        )}
      </div>
    </section>
  );
}

/** One player's chip in their colour; `pop` counts their test buzzes. */
function PlayerChip({ player, pop }: { player: RankedPlayer; pop: number | undefined }) {
  return (
    <li
      style={{ backgroundColor: player.color }}
      data-practice={pop}
      className={`rounded-full px-[0.73em] py-[0.25em] font-display text-bg ${pop === undefined ? 'motion-safe:animate-pop-in' : 'motion-safe:animate-chip-bump'} ${player.connected ? '' : 'opacity-40'}`}
    >
      <PlayerAvatar avatar={player.avatar} className="mr-[0.3em]" />
      {player.name}
    </li>
  );
}

/** Cycles Sound on, Quiet and Muted, labelled with the current level (UI spec, Screen view). */
function SoundButton() {
  const level = useSoundLevel();
  return (
    <button
      type="button"
      onClick={cycleSoundLevel}
      aria-keyshortcuts="M"
      className={`rounded-2xl border-2 border-edge bg-surface px-[1em] py-[0.5em] font-display text-[1.78cqw] transition not-disabled:active:scale-95 ${HOVER}`}
    >
      {SOUND_LEVEL_LABEL[level]}
      <kbd aria-hidden className="ml-[0.5em] font-mono text-[0.8em] opacity-70">
        M
      </kbd>
    </button>
  );
}

/** `M` cycles the sound level while `enabled`, for a Screen without the host bar's shortcuts. */
function useSoundKey(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'm') return;
      e.preventDefault();
      cycleSoundLevel();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [enabled]);
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

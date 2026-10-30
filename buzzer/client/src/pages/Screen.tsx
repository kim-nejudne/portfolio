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
import { useCopy } from '../lib/copy.js';
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
import { useMediaQuery } from '../lib/useMediaQuery.js';
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
    // A size container, so the Screen's `cqw`/`cqh` and its `stage-*` variants follow it (F100).
    <main className="flex h-dvh flex-col overflow-hidden bg-bg [container-type:size]">
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
      <PhoneNote url={url} />
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
          // Sized in rem for a laptop Screen, like the lobby's Game setup; doubled on a 4K display.
          className={ZOOM_4K}
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
  const t = useCopy();
  // The difficulty in the room's language; its keys are the difficulty ids (F91).
  const details = [view.category, view.difficulty && t(view.difficulty)].filter(Boolean);
  return (
    <section
      aria-label="Title card"
      className="flex flex-1 flex-col items-center justify-center gap-[4vh] px-[min(6vw,10.67vh)] text-center motion-safe:animate-pop-in"
    >
      <p className="text-[max(var(--screen-min-label),min(1.8vw,3.2vh))] font-bold tracking-[0.25em] text-muted uppercase">
        {t('titleCardReady')}
      </p>
      <h1 className="font-display text-[max(var(--screen-min-name),min(6vw,12vh))] leading-tight text-balance break-words text-accent [text-shadow:min(0.4vw,0.72vh)_min(0.4vw,0.72vh)_0_var(--color-bg-deep)]">
        {view.title}
      </h1>
      {details.length > 0 && (
        <p className="font-display text-[max(var(--screen-min-body),min(3vw,5.5vh))] text-ink">
          {details.join(' · ')}
        </p>
      )}
    </section>
  );
}

/** Past this many players, the lobby makes room for more chips. */
const MANY_PLAYERS = 20;
/** Chip text as a share of the lobby column's width: 2.44 cqw and 1.56 cqw before F38. */
const CHIP_MAX_FEW = 0.0244;
const CHIP_MAX_MANY = 0.0156;
/** Chips never go below the Screen's 14px floor; past it, the last chip says "+N more" (F100). */
const CHIP_MIN_PX = 14;

/**
 * The lobby's rem-sized panels doubled on a 4K display. Width alone would catch a 2560×1080
 * ultrawide, where the doubled Game setup would scroll (SCR-02).
 */
const ZOOM_4K = '[@media(min-width:2560px)_and_(min-height:1440px)]:[zoom:2]';

/** The lobby's small uppercase labels: the set's title, Room code, the player count. */
const LOBBY_LABEL =
  'text-[max(var(--screen-min-label),min(1.6cqw,2.9vh))] font-bold tracking-[0.25em] text-muted uppercase';
/** Small lobby text: Pair host phone, the sound button, the localhost note. */
const LOBBY_SMALL = 'text-[max(var(--screen-min-label),min(1.78cqw,3.2vh))]';

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
  // A narrow column stacks the QR under the code, where it can take more of the width (F100).
  // On an ultrawide display the code and QR are capped harder by height, so the chips keep room.
  const qrSize = many
    ? 'size-[min(30vh,22cqw)] ultrawide:size-[min(22vh,22cqw)] @max-[37.5rem]:size-[min(26vh,50cqw)]'
    : 'size-[min(36vh,28cqw)] ultrawide:size-[min(24vh,28cqw)] @max-[37.5rem]:size-[min(30vh,60cqw)]';
  const t = useCopy();
  return (
    // Portrait or under 1000px wide, Game setup goes under the room's column, full width. Then,
    // and only on a device that hosts, the lobby may scroll: the one exception to the Screen's
    // no-scroll rule, so the code, the QR and every setting stay whole (SCR-06).
    <div
      className={`flex min-h-0 flex-1 gap-[min(3vw,5.34vh)] px-[min(3.75vw,6.67vh)] pt-[2vh] pb-[3vh] stage-narrow:flex-col ${command ? 'stage-narrow:overflow-y-auto' : ''}`}
    >
      {/* A size container: without the panel it is 90vw wide, so N vw is written N / 0.9 cqw and
          nothing changes; beside the panel everything shrinks with it instead of wrapping. Each
          size also has a vh cap for ultrawide displays and a px floor for small ones (F100). */}
      <div
        className={`@container flex min-h-0 min-w-0 flex-1 flex-col gap-[3vh] ${command ? 'stage-narrow:min-h-fit' : ''}`}
      >
        <div className="flex items-center justify-between gap-[min(4.44cqw,8vh)] @max-[37.5rem]:flex-col @max-[37.5rem]:items-stretch">
          <div className="flex min-w-0 flex-col gap-[1vh]">
            <p className={LOBBY_LABEL}>{view.title}</p>
            <p className="text-[max(var(--screen-min-body),min(2.89cqw,5.2vh))]">{t('joinAt')}</p>
            <p className="font-display text-[max(var(--screen-min-body),min(3.56cqw,6.4vh))] break-all text-accent">
              {displayUrl(url)}
            </p>
            <p className={`mt-[2vh] ${LOBBY_LABEL}`}>{t('roomCode')}</p>
            <h1
              className={`font-display ${many ? 'text-[clamp(3rem,12cqw,24vh)] ultrawide:text-[clamp(3rem,12cqw,18vh)]' : 'text-[clamp(4rem,16.67cqw,32vh)] ultrawide:text-[clamp(4rem,16.67cqw,20vh)]'} leading-none tracking-[0.12em] text-accent [text-shadow:min(0.4cqw,0.72vh)_min(0.4cqw,0.72vh)_0_var(--color-bg-deep)]`}
            >
              {view.code}
            </h1>
            {unreachable && (
              <p role="note" className={`${LOBBY_SMALL} text-muted`}>
                Phones can’t open localhost. Open this page at this computer’s network address
                instead.
              </p>
            )}
          </div>
          {/* Pair host phone sits under the join QR, where the column has height to spare (F38). */}
          <div className="flex shrink-0 flex-col items-center gap-[2vh]">
            {/* White behind the QR, so every phone camera reads it, inside the gold stage ring. */}
            <div className="rounded-[2vh] bg-white p-[2vh] shadow-[0_0_0_min(0.47vw,0.84vh)_var(--color-bg),0_0_0_min(0.78vw,1.39vh)_var(--color-accent)]">
              <QRCodeSVG
                value={url}
                title={`${t('joinAt')} ${url}`}
                marginSize={0}
                className={qrSize}
              />
            </div>
            {/* A token-less Screen has no host bar, so its sound button lives here (F62). */}
            {!command && <SoundButton />}
            {hostToken && (
              <PairHostPhone
                code={view.code}
                hostToken={hostToken}
                className={LOBBY_SMALL}
                dialogClassName="text-[clamp(1rem,1.8vw,3.2vh)]"
                qrSize="min(58vh, 45vw)"
              />
            )}
          </div>
        </div>
        <PlayerChips players={view.players} teams={view.teams} scrolls={command !== null} />
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
      // Sized in rem for a laptop Screen; doubled on a 4K display so it stays readable. Stacked
      // under the room, it takes the full width.
      className={`flex w-[min(28rem,30vw)] shrink-0 flex-col gap-3 overflow-y-auto stage-narrow:w-full ${ZOOM_4K}`}
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
interface PlayerChipsProps {
  players: RankedPlayer[];
  teams: TeamView[] | null;
  /** The stacked lobby scrolls: the chips then keep a share of the height of their own. */
  scrolls: boolean;
}

function PlayerChips({ players, teams, scrolls }: PlayerChipsProps) {
  // The box the chips must fit: the one list, or every team's column.
  const listRef = useRef<HTMLDivElement>(null);
  const pops = usePracticePops();
  const t = useCopy();
  // Smaller chips past 20 players, and smaller still if the room's names would not fit: nobody can
  // scroll a TV, so every chip must stay above the bottom strip (F38). A move between teams
  // changes the columns' heights, so the teams are part of what it fits. At the 14px floor, a list
  // that still does not fit ends in "+N more" (F100).
  const shown = useShrinkToFit(
    listRef,
    players.length > MANY_PLAYERS ? CHIP_MAX_MANY : CHIP_MAX_FEW,
    CHIP_MIN_PX,
    players.map((player) => `${player.avatar ?? ''}${player.name}`).join('\n') +
      (teams ? `\n${teams.map((team) => team.memberIds.join(',')).join('|')}` : ''),
    true,
  );
  if (players.length === 0 && !teams) {
    return (
      <p className="text-[max(var(--screen-min-body),min(2.67cqw,4.8vh))] text-muted">
        {t('waitingForPlayers')}
      </p>
    );
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
  // One group's chips, cut to what fits, then "+N more" for the rest.
  const chips = (group: string, members: RankedPlayer[]) => {
    const count = shown?.[group] ?? members.length;
    return (
      <ul data-fit-group={group} className="flex flex-wrap content-start gap-[0.45em]">
        {members.slice(0, count).map(chip)}
        {count < members.length && (
          <li
            data-more
            className="rounded-full border-[0.1em] border-edge px-[0.73em] py-[0.15em] font-display text-muted"
          >
            {t('plusMore', { n: members.length - count })}
          </li>
        )}
      </ul>
    );
  };
  const byId = new Map(players.map((player) => [player.id, player]));
  return (
    <section
      aria-label="Players"
      className={`flex min-h-0 flex-1 flex-col gap-[2vh] ${scrolls ? 'stage-narrow:min-h-[30cqh]' : ''}`}
    >
      <p className={LOBBY_LABEL}>
        {t(players.length === 1 ? 'playerCountOne' : 'playerCount', { n: players.length })}
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
                    <span className="shrink-0 text-[max(var(--screen-min-label),0.7em)] text-muted tabular-nums">
                      {members.length}
                    </span>
                  </h2>
                  {members.length === 0 ? (
                    <p className="text-[max(var(--screen-min-label),0.7em)] text-muted">
                      {t('noPlayersYet')}
                    </p>
                  ) : (
                    chips(String(team.index), members)
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          chips('all', players)
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

/** Under Tailwind's `sm` (640px): a phone, not a TV or laptop. */
const PHONE_QUERY = '(max-width: 39.99rem)';

/**
 * On a phone-sized display, a dismissible line saying the Screen is meant for a TV and where
 * players join (SCR-08). The Screen keeps its layout: the floors keep it legible (F100).
 */
function PhoneNote({ url }: { url: string }) {
  const phone = useMediaQuery(PHONE_QUERY);
  const [dismissed, setDismissed] = useState(false);
  const t = useCopy();
  if (!phone || dismissed) return null;
  return (
    <div
      role="note"
      className="flex shrink-0 items-center gap-2 border-y-2 border-edge bg-surface py-1 pl-4 text-sm text-muted"
    >
      <p className="min-w-0 flex-1 break-words">{t('screenPhoneNote', { url: displayUrl(url) })}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className={`grid size-11 shrink-0 place-items-center rounded-full ${HOVER}`}
      >
        <Icon name="x" className="size-5" />
      </button>
    </div>
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
      className={`rounded-2xl border-2 border-edge bg-surface px-[1em] py-[0.5em] font-display ${LOBBY_SMALL} transition not-disabled:active:scale-95 ${HOVER}`}
    >
      {SOUND_LEVEL_LABEL[level]}
      <kbd
        aria-hidden
        className="ml-[0.5em] font-mono text-[max(var(--screen-min-label),0.8em)] opacity-70"
      >
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

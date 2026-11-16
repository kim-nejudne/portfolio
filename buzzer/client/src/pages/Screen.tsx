import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
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
import { ScreenHeader } from '../components/ScreenChrome.js';
import { ScreenBoard } from '../components/ScreenBoard.js';
import { ScreenHostControls } from '../components/ScreenHostControls.js';
import { ScreenFlash } from '../components/ScreenFlash.js';
import { ScreenQuestion } from '../components/ScreenQuestion.js';
import { FinalResults, Scoreboard } from '../components/ScreenResults.js';
import { StartOverlay } from '../components/StartOverlay.js';
import { RAIL_HIDDEN_QUERY } from '../components/StandingsRail.js';
import { Toast, useToast } from '../components/Toast.js';
import { firstUnused, tileOf, type BoardCursor } from '../lib/boardCursor.js';
import { enterFullscreen } from '../lib/fullscreen.js';
import { clearHostToken, loadHostToken } from '../lib/hostTokens.js';
import { HOVER } from '../lib/hover.js';
import { useCopy } from '../lib/copy.js';
import { displayUrl, isLoopbackHost, joinPageOrigin, joinUrl, urlParts } from '../lib/joinUrl.js';
import { JOIN_ADDRESS, nameFitSize } from '../lib/nameFit.js';
import { JoinAddress } from '../components/JoinAddress.js';
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
import { SCREEN_BUTTON_OUTLINE, SCREEN_BUTTON_PRIMARY } from '../lib/ui.js';
import { useShrinkToFit } from '../lib/useShrinkToFit.js';
import { ColourDot } from '../components/ColourDot.js';

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
  // The host bar's measured height while it shows: the content, the toast and the shortcut chip
  // stay above it, and take the full height when it hides (SCR-09, SCR-14).
  const [barHeight, setBarHeight] = useState(0);

  return (
    // A size container, so the Screen's `cqw`/`cqh` and its `stage-*` variants follow it (F100).
    <main
      // With host controls, the hidden bar leaves the Shortcuts hint in the bottom-left corner:
      // the game's content keeps clear of it (F137). Unset elsewhere, so the editor's preview has none.
      style={canHost ? ({ '--hint-reserve': HINT_RESERVE } as CSSProperties) : undefined}
      className="flex h-dvh flex-col overflow-hidden bg-bg [container-type:size]"
    >
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
      {/* Under the header, not over it, so the join address stays readable (SCR-16). */}
      <ReconnectingBanner />
      <PhoneNote url={url} />
      <div
        style={
          {
            // The lobby keeps the bar's room whether it shows or not, so showing it never moves
            // Start game under the pointer (F155). Elsewhere the content takes the hidden bar's room.
            '--bar-reserve':
              canHost && view.phase === 'LOBBY'
                ? `max(${BAR_RESERVE}, ${barHeight}px)`
                : `${barHeight}px`,
          } as CSSProperties
        }
        className="relative flex min-h-0 flex-1 flex-col"
      >
        {/* With the host bar showing, the content stops above it, so it never hides the reveal or the podium. */}
        <div className="relative flex min-h-0 flex-1 flex-col mb-[var(--bar-reserve)]">
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
              onCursor={canHost ? setCursor : undefined}
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
            onHeight={setBarHeight}
          />
        )}
        <Toast toast={toast} variant="screen" />
      </div>
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
    </main>
  );
}

/** The Shortcuts hint's place at the bottom (`ScreenHostControls`): its 1.2vh inset, its line and border, and a 1vh gap. */
/**
 * The host bar's height before it is measured: its 4px rule, its padding, and one row of buttons
 * (2px borders, 0.6vh padding, a 1.5 line of its type), rounded up. It wraps only on a narrow
 * stage, where the measured height takes over.
 */
const BAR_RESERVE = 'calc(10px + 3.8vh + 1.6 * clamp(0.875rem, 1.1vw, 1.75rem))';
const HINT_RESERVE = 'calc(2.2vh + 1.6 * max(var(--screen-min-label), min(0.9vw, 1.6vh)) + 4px)';

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
      className="flex flex-1 flex-col items-center justify-center gap-[4vh] px-[min(6vw,10.67vh)] text-center"
    >
      <p className="font-outlier text-[max(var(--screen-min-label),min(1.8vw,3.2vh))] font-semibold text-muted">
        {t('titleCardReady')}
      </p>
      {/* Wide capitals under the 4px ink bar (design.md Rules). */}
      <h1 className="border-t-4 border-ink pt-[2vh] font-display text-[max(var(--screen-min-name),min(5vw,10vh))] leading-tight text-balance break-words text-ink uppercase">
        {view.title}
      </h1>
      {details.length > 0 && (
        <p className="text-[max(var(--screen-min-body),min(3vw,5.5vh))] font-semibold text-ink">
          {details.join(' · ')}
        </p>
      )}
    </section>
  );
}

/** Past this many players, the lobby makes room for more rows. */
const MANY_PLAYERS = 20;
/** Rows per column, up to four columns, so the names stay large on the pass. */
const ROWS_PER_COLUMN = 3;
const MAX_COLUMNS = 4;
/**
 * Row text as a share of the players' list width: 1.6 cqw of the lobby, as in the mock, on a list
 * about 53 cqw wide (F146). Smaller past 20 players.
 */
const CHIP_MAX_FEW = 0.03;
const CHIP_MAX_MANY = 0.022;
/** Rows never go below the Screen's 14px floor; past it, the last row says "+N more" (F100). */
const CHIP_MIN_PX = 14;

/**
 * The lobby's rem-sized panels doubled on a 4K display. Width alone would catch a 2560×1080
 * ultrawide, where the doubled Game setup would scroll (SCR-02).
 */
const ZOOM_4K = '[@media(min-width:2560px)_and_(min-height:1440px)]:[zoom:2]';

/** The lobby's small print: Room code, Join at. Archivo Narrow 600 (design.md Rules). */
const LOBBY_LABEL =
  'font-outlier text-[max(var(--screen-min-label),min(1.25cqw,2.25vh))] font-semibold leading-tight';
/** The host row's controls: Start game, Settings, Pair host phone, the sound button (the mock's 1.8 cqw). */
const LOBBY_CONTROL =
  'px-[min(2cqw,3.6vh)] py-[min(1.2cqw,2.2vh)] text-[max(var(--screen-min-label),min(1.8cqw,3.2vh))]';
/** Small lobby text: Pair host phone, the localhost note. */
const LOBBY_SMALL = 'text-[max(var(--screen-min-label),min(1.3cqw,2.35vh))]';

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

/**
 * The mock's lobby (F146): the set's title and the code on the teal pass, the join QR under the ink
 * bar, the players on the orange pass crossing the code, and the host's controls bottom left.
 * Game setup's settings stand beside it while they show (F37, F66).
 */
function Lobby({ view, url, unreachable, hostToken, command }: LobbyProps) {
  // A full room gives the rows more height: a smaller (still huge) code and join QR.
  const many = view.players.length > MANY_PLAYERS;
  // Narrower than 600px the lobby is one column, where the QR can take more of the width (F100).
  const qrSize = many
    ? 'w-[min(16cqw,28.8vh)] @max-[37.5rem]:w-[min(20vh,50cqw)]'
    : 'w-[min(20cqw,36vh)] @max-[37.5rem]:w-[min(24vh,60cqw)]';
  // With a host phone paired, the settings fold behind a Settings button: the remote has them too (F66).
  const folded = view.hostDevices > 0;
  const [open, setOpen] = useState(false);
  const settingsId = useId();
  const t = useCopy();
  return (
    // Portrait or under 1000px wide, Game setup goes under the room's column, full width. Then,
    // and only on a device that hosts, the lobby may scroll: the one exception to the Screen's
    // no-scroll rule, so the code, the QR and every setting stay whole (SCR-06). Its foot keeps
    // clear of the host bar's Shortcuts hint, bottom left like the host row (F137).
    <div
      className={`flex min-h-0 flex-1 gap-[min(3vw,5.34vh)] px-[min(3.75vw,6.67vh)] pt-[2vh] pb-[max(3vh,var(--hint-reserve,0px))] stage-narrow:flex-col ${command ? 'stage-narrow:overflow-y-auto' : ''}`}
    >
      {/* A size container: the lobby's cqw follow its own width, so beside Game setup everything
          shrinks with it instead of wrapping. Each cqw has a vh cap for ultrawide displays and
          each text size a px floor for small ones (F100). */}
      <div
        className={`@container flex min-h-0 min-w-0 flex-1 flex-col ${command ? 'stage-narrow:min-h-fit' : ''}`}
      >
        <div className="lobby-stage">
          <div className="lobby-head">
            <p className="lobby-title text-[max(var(--screen-min-label),min(1.5cqw,2.7vh))] font-semibold">
              {view.title}
            </p>
            <div className="lobby-code">
              <p className={LOBBY_LABEL}>{t('roomCode')}</p>
              {/* The signature: the code as an Anybody 900 figure at 150%, on the teal pass (M32). */}
              <h1
                className={`font-display ${many ? 'text-[clamp(3rem,9cqw,15vh)]' : 'text-[clamp(3rem,11.5cqw,18vh)]'} leading-none font-black whitespace-nowrap uppercase font-stretch-150% tabular-nums`}
              >
                {view.code}
              </h1>
              {unreachable && (
                <p role="note" className={LOBBY_SMALL}>
                  Phones can’t open localhost. Open this page at this computer’s network address
                  instead.
                </p>
              )}
            </div>
          </div>
          {/* The QR under the ink bar, and the address under it, ink on newsprint. The address
              takes the column's full width and steps down so its longest part fits one line: it
              breaks only before a slash (F155). */}
          <div className="lobby-qr">
            <div className={qrSize}>
              <QRCodeSVG
                value={url}
                title={`${t('joinAt')} ${url}`}
                marginSize={0}
                bgColor="transparent"
                className="h-auto w-full"
              />
            </div>
            <p className="text-[max(var(--screen-min-body),min(1.45cqw,2.6vh))] leading-snug [container-type:inline-size]">
              {t('joinAt')}{' '}
              <JoinAddress
                url={url}
                className="block font-semibold"
                style={{
                  fontSize: nameFitSize(
                    urlParts(url).reduce((a, b) => (b.length > a.length ? b : a)),
                    JOIN_ADDRESS,
                  ),
                }}
              />
            </p>
          </div>
          <PlayerChips players={view.players} teams={view.teams} scrolls={command !== null} />
          <div className="lobby-host">
            {command && (
              <button
                type="button"
                onClick={() => command.run('host:start', {})}
                disabled={command.busy}
                aria-keyshortcuts="Space"
                className={`${SCREEN_BUTTON_PRIMARY} ${LOBBY_CONTROL} flex items-center gap-[0.6em]`}
              >
                Start game
                {/* No key hint on touch (SCR-12). */}
                <kbd
                  aria-hidden
                  className="font-outlier text-[max(var(--screen-min-label),0.8em)] normal-case opacity-80 pointer-coarse:hidden"
                >
                  Space
                </kbd>
              </button>
            )}
            {command && folded && (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={settingsId}
                onClick={() => setOpen((o) => !o)}
                className={`${SCREEN_BUTTON_OUTLINE} ${LOBBY_CONTROL}`}
              >
                Settings
                <span aria-hidden className={`ml-[0.4em] inline-block ${open ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>
            )}
            {hostToken && (
              <PairHostPhone
                code={view.code}
                hostToken={hostToken}
                className={LOBBY_SMALL}
                dialogClassName="text-[clamp(1rem,1.8vw,3.2vh)]"
                // Centred, the dialog ends above the host bar's room: the QR gives up what its
                // text (about 12em) and the bar's room top and bottom need (F155).
                qrSize={`min(58vh, 45vw, calc(100vh - 12em - 2 * ${BAR_RESERVE}))`}
              />
            )}
            {/* A token-less Screen has no host bar, so its sound button lives here (F62). */}
            {!command && <SoundButton />}
          </div>
        </div>
      </div>
      {command && (!folded || open) && (
        <LobbySettings id={settingsId} view={view} command={command} />
      )}
    </div>
  );
}

/**
 * Game setup: the room's settings beside the lobby, for a host with no paired phone, or opened
 * from Settings (F37, F66).
 */
function LobbySettings({
  id,
  view,
  command,
}: {
  id: string;
  view: ScreenView;
  command: HostCommand;
}) {
  const standingsHidden = useMediaQuery(RAIL_HIDDEN_QUERY);
  return (
    <aside
      id={id}
      aria-label="Game setup"
      // Sized in rem for a laptop Screen; doubled on a 4K display so it stays readable. Stacked
      // under the room, it takes the full width.
      className={`flex w-[min(28rem,30vw)] shrink-0 flex-col gap-3 overflow-y-auto border-t-4 border-ink pt-3 stage-narrow:w-full ${ZOOM_4K}`}
    >
      <HostSettings view={view} command={command} compact standingsHidden={standingsHidden} />
    </aside>
  );
}

/**
 * The joined players as ruled rows on the orange pass (F146). With teams on, one column per team
 * in index order, each headed by the team's name and colour, its members in join order (F82).
 */
interface PlayerChipsProps {
  players: RankedPlayer[];
  teams: TeamView[] | null;
  /** The stacked lobby scrolls: the rows then keep a share of the height of their own. */
  scrolls: boolean;
}

function PlayerChips({ players, teams, scrolls }: PlayerChipsProps) {
  // The box the rows must fit: the one list, or every team's column.
  const listRef = useRef<HTMLDivElement>(null);
  const pops = usePracticePops();
  const t = useCopy();
  // Smaller rows past 20 players, and smaller still if the room's names would not fit: nobody can
  // scroll a TV, so every row must stay on screen (F38). A move between teams changes the columns'
  // heights, so the teams are part of what it fits. At the 14px floor, a list that still does not
  // fit ends in "+N more" (F100).
  const shown = useShrinkToFit(
    listRef,
    players.length > MANY_PLAYERS ? CHIP_MAX_MANY : CHIP_MAX_FEW,
    CHIP_MIN_PX,
    players.map((player) => `${player.avatar ?? ''}${player.name}`).join('\n') +
      (teams ? `\n${teams.map((team) => team.memberIds.join(',')).join('|')}` : ''),
    true,
  );
  const chip = (player: RankedPlayer) => {
    // A test buzz remounts the row under a new key, so its bump replays (F60).
    const pop = pops.get(player.id);
    return (
      <PlayerChip
        key={pop === undefined ? player.id : `${player.id}:${pop}`}
        player={player}
        pop={pop}
      />
    );
  };
  // One group's rows, cut to what fits, then "+N more" for the rest.
  const chips = (group: string, members: RankedPlayer[], columns = 1) => {
    const count = shown?.[group] ?? members.length;
    return (
      <ul
        data-fit-group={group}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        className="grid content-start gap-x-[1em] gap-y-[0.3em]"
      >
        {members.slice(0, count).map(chip)}
        {count < members.length && (
          <li data-more className={`${ROW} font-semibold`}>
            {t('plusMore', { n: members.length - count })}
          </li>
        )}
      </ul>
    );
  };
  const byId = new Map(players.map((player) => [player.id, player]));
  const empty = players.length === 0 && !teams;
  return (
    <section
      aria-label="Players"
      className={`lobby-players flex flex-col gap-[min(1cqw,1.8vh)] ${scrolls ? 'stage-narrow:min-h-[30cqh]' : ''}`}
    >
      <p className="font-display text-[max(var(--screen-min-body),min(2.2cqw,4vh))] leading-none font-black uppercase font-stretch-140%">
        {empty
          ? t('waitingForPlayers')
          : t(players.length === 1 ? 'playerCountOne' : 'playerCount', { n: players.length })}
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
                  className="flex min-w-0 flex-col gap-[0.3em]"
                >
                  <h2 className="flex items-baseline justify-between gap-[0.5em] border-t-4 border-ink pt-[0.3em] font-outlier text-[1em] font-semibold normal-case [font-stretch:100%]">
                    <span className="flex min-w-0 items-center gap-[0.4em]">
                      <ColourDot
                        color={team.color}
                        square
                        className="ml-[2px] size-[0.7em] border-[0.1em] border-paper ring-2 ring-ink"
                      />
                      <span className="truncate">{team.name}</span>
                    </span>
                    <span className="shrink-0 text-[max(var(--screen-min-label),0.8em)] tabular-nums">
                      {members.length}
                    </span>
                  </h2>
                  {members.length === 0 ? (
                    <p className="text-[max(var(--screen-min-label),0.8em)]">{t('noPlayersYet')}</p>
                  ) : (
                    chips(String(team.index), members)
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          !empty &&
          chips('all', players, Math.min(MAX_COLUMNS, Math.ceil(players.length / ROWS_PER_COLUMN)))
        )}
      </div>
    </section>
  );
}

/** A ruled row: the mock's hairline in ink over each name. */
// A long name is clipped at the column's edge rather than running into the next.
const ROW =
  'flex min-w-0 items-center gap-[0.5em] overflow-hidden border-t border-ink pt-[0.25em] whitespace-nowrap';

/** One player's row with their colour; `pop` counts their test buzzes. */
function PlayerChip({ player, pop }: { player: RankedPlayer; pop: number | undefined }) {
  return (
    <li
      data-practice={pop}
      className={`${ROW} font-semibold ${pop === undefined ? '' : 'motion-safe:animate-chip-bump'} ${player.connected ? '' : 'opacity-40'}`}
    >
      {/* Inset by its ring's 2px, which the row's clip would cut. The paper gap keeps an orange fill a fill on the orange pass (F155). */}
      <ColourDot
        color={player.color}
        square
        className="ml-[2px] size-[0.7em] border-[0.1em] border-paper ring-2 ring-ink"
      />
      <PlayerAvatar avatar={player.avatar} />
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
      className="flex shrink-0 items-center gap-2 bg-surface py-1 pl-4 text-sm text-muted"
    >
      <p className="min-w-0 flex-1 break-words">{t('screenPhoneNote', { url: displayUrl(url) })}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className={`grid size-11 shrink-0 place-items-center ${HOVER}`}
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
      className={`${SCREEN_BUTTON_OUTLINE} ${LOBBY_CONTROL}`}
    >
      {SOUND_LEVEL_LABEL[level]}
      <kbd
        aria-hidden
        className="ml-[0.5em] font-outlier text-[max(var(--screen-min-label),0.8em)] normal-case opacity-80"
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
    </main>
  );
}

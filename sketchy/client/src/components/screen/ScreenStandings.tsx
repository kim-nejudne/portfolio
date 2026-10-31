import type { CSSProperties } from 'react';
import type { PlayerChipView, ScreenView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import type { ScreenGallery as GalleryStore } from '../../lib/gallery.js';
import { CONFIRM_LABELS, LABELS, type ControlId } from '../../lib/hostKeys.js';
import { useHostTaps } from '../../lib/hostTaps.js';
import {
  codeStripCode,
  rankPlayers,
  type RankedPlayer,
  type ScreenLayout,
} from '../../lib/screen.js';
import type { GameSocket } from '../../lib/socket.js';
import { Avatar } from '../Avatar.js';
import { sketchButtonClass } from '../sketch/SketchButton.js';
import { ScreenAwards } from './ScreenAwards.js';
import { ScreenDesk } from './ScreenDesk.js';
import { ScreenGallery } from './ScreenGallery.js';

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * SCOREBOARD and FINAL in the sketchbook (F66). SCOREBOARD is one dot-grid page: "Round 1 of 2
 * done" and the ranked rows, each sliding from its place before the round's last turn, with a
 * crayon bar and ↑n/↓n. FINAL is a spread: the podium, 4th and later on a line and (from game 2)
 * the Tonight panel on the left page; Tonight's awards on sticky notes, the gallery's taped sheets
 * and, on the token Screen, Rematch and Back to lobby on the right.
 */
export function ScreenStandings({
  view,
  layout,
  gallery,
  socket,
  t,
}: {
  view: ScreenView;
  layout: ScreenLayout;
  /** FINAL's drawings; SCOREBOARD has none. */
  gallery?: GalleryStore;
  /** The token Screen's socket, for Rematch and Back to lobby on the final page. */
  socket?: GameSocket;
  t: Translate;
}) {
  if (view.phase === 'FINAL')
    return <Final view={view} layout={layout} gallery={gallery} socket={socket} t={t} />;
  return (
    <ScreenDesk
      layout={layout}
      code={codeStripCode(view)}
      single={<Scoreboard view={view} layout={layout} t={t} />}
    />
  );
}

// ---------- Scoreboard ----------

/** The scoreboard's row text, and the gap between rows. */
const BOARD_TEXT = 'max(4.5vmin, 20px)';
const BOARD_TEXT_CLASS = 'text-[max(4.5vmin,20px)]';
const ROW_GAP_VMIN = 1.5;
const COLUMN_GAP_VMIN = 5;

function Scoreboard({ view, layout, t }: { view: ScreenView; layout: ScreenLayout; t: Translate }) {
  const ranked = rankPlayers(view.players);
  // Above six players, two columns (ranks run down the first, then the second) so twelve fit a
  // TV. Portrait has the height for one column, and two would cut the names short.
  const twoColumns = layout === 'landscape' && ranked.length > 6;
  const rows = twoColumns ? Math.ceil(ranked.length / 2) : ranked.length;
  const before = previousPlaces(view.players);
  const top = Math.max(1, ...ranked.map(({ player }) => player.score ?? 0));
  const place = (i: number) =>
    twoColumns ? { col: Math.floor(i / rows), row: i % rows } : { col: 0, row: i };
  return (
    <div className="flex h-full flex-col items-center gap-[2.5vmin] overflow-hidden px-[6vmin] py-[4vmin]">
      {/* Left, over the rows (the mockup's). */}
      <h1
        className="w-full text-[max(7vmin,32px)] leading-tight"
        style={{ maxWidth: twoColumns ? '165vmin' : '130vmin' }}
      >
        {t('roundDone', { cycle: view.turn?.cycle ?? 1, cycles: view.settings.cycles })}
      </h1>
      {/* The rows take the height under the title, their text shrinking to fit it (`fitRows`). */}
      <div className="min-h-0 w-full flex-1 overflow-y-auto [container-type:size] [scrollbar-width:thin]">
        <ol
          data-scoreboard
          className={`mx-auto grid w-full gap-x-[5vmin] ${BOARD_TEXT_CLASS} ${twoColumns ? 'grid-flow-col grid-cols-2' : ''}`}
          style={{
            ...(twoColumns ? { gridTemplateRows: `repeat(${rows}, auto)` } : {}),
            maxWidth: twoColumns ? '165vmin' : '130vmin',
            rowGap: `${ROW_GAP_VMIN}vmin`,
            // As tall as the height allows, and no wider than a column holds (`ROW_EMS`).
            fontSize: `min(${fitRows(BOARD_TEXT, rows, ROW_GAP_VMIN)}, ${fitRowWidth(twoColumns ? 2 : 1)})`,
          }}
        >
          {ranked.map(({ player, rank }, i) => {
            const from = before?.get(player.pid);
            const now = place(i);
            const then = from === undefined ? now : place(from);
            const moved = player.prevRank === undefined ? 0 : player.prevRank - rank;
            const style: CSSProperties = {
              // From where the row stood before the last turn, in its own size plus the gaps.
              ['--move-x' as string]: `calc(${then.col - now.col} * (100% + ${COLUMN_GAP_VMIN}vmin))`,
              ['--move-y' as string]: `calc(${then.row - now.row} * (100% + ${ROW_GAP_VMIN}vmin))`,
            };
            return (
              <li
                key={player.pid}
                data-row={player.pid}
                className="grid min-w-0 grid-cols-[1.6em_1.5em_5em_minmax(4em,1fr)_3.6em_1.9em] items-center gap-x-[0.45em] py-[0.25em] motion-safe:animate-move"
                style={style}
              >
                <span className="text-center font-num font-black tabular-nums">
                  <span aria-hidden="true">{rank}</span>
                  <span className="sr-only">{rank}.</span>
                </span>
                <Avatar player={player} size="1.5em" />
                <span className="truncate" style={{ color: player.color }}>
                  {player.name}
                </span>
                <span
                  aria-hidden
                  data-bar
                  className="block h-[0.8em] overflow-hidden bg-canvas rounded-[0.12em_0.45em_0.12em_0.45em] border-[length:max(2px,0.32vmin)] border-ink"
                >
                  <i
                    className="block h-full motion-safe:animate-grow"
                    style={{
                      width: `${Math.round(((player.score ?? 0) / top) * 100)}%`,
                      background: player.color,
                    }}
                  />
                </span>
                <span className="text-right font-num font-black tabular-nums">
                  {(player.score ?? 0).toLocaleString('en')}
                </span>
                <Move n={moved} t={t} />
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** ↑2 in the success colour or ↓1 in red pen; nothing for a row that stayed. */
function Move({ n, t }: { n: number; t: Translate }) {
  if (n === 0) return <span />;
  return (
    <span
      data-move={n > 0 ? 'up' : 'down'}
      className={`text-left font-num text-[0.7em] font-black tabular-nums ${n > 0 ? 'text-success' : 'text-red'}`}
    >
      <span aria-hidden="true">{n > 0 ? `↑${n}` : `↓${-n}`}</span>
      <span className="sr-only">{t(n > 0 ? 'movedUp' : 'movedDown', { n: Math.abs(n) })}</span>
    </span>
  );
}

/**
 * Each row's place before the round's last turn (by the view's `prevRank`, ties in the view's
 * order, as `rankPlayers` lists them now), or null when the view has none.
 */
export function previousPlaces(players: readonly PlayerChipView[]): Map<string, number> | null {
  if (players.length === 0 || players.some((p) => p.prevRank === undefined)) return null;
  const order = players
    .map((p, i) => ({ pid: p.pid, rank: p.prevRank!, i }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i);
  return new Map(order.map((p, place) => [p.pid, place]));
}

/**
 * How many em a scoreboard row needs: rank, avatar, a 5 em name (about seven letters), a 4 em bar
 * at the least, a "12,345" score, the move and the gaps.
 */
const ROW_EMS = 20;

/** The rows' font size at most, so `columns` columns of `ROW_EMS` fit their box's width. */
export function fitRowWidth(columns: number): string {
  return `calc((100cqw - ${(columns - 1) * COLUMN_GAP_VMIN}vmin) / ${columns * ROW_EMS})`;
}

/** The smallest the score rows shrink to before their box scrolls instead. */
const ROW_TEXT_FLOOR = 'max(2vmin, 13px)';

/**
 * The rows' font size: `size`, or smaller when `rows` rows (each 2em: a 1.5em line or avatar and
 * 0.25em padding above and below, plus the gaps) wouldn't fit the height of their
 * `[container-type:size]` box, down to `ROW_TEXT_FLOOR`.
 */
export function fitRows(size: string, rows: number, gapVmin: number): string {
  const gaps = (rows - 1) * gapVmin;
  return `max(${ROW_TEXT_FLOOR}, min(${size}, calc((100cqh - ${gaps}vmin) / ${rows * 2})))`;
}

// ---------- Final ----------

/**
 * A podium block's height by shared rank (shorter in portrait, where the podium's page shares the
 * height with the gallery's), and when it rises: 3rd, then 2nd, then 1st.
 */
const BLOCK_HEIGHT = {
  landscape: ['22vmin', '15vmin', '10vmin'],
  portrait: ['13vmin', '9vmin', '6vmin'],
};
const RISE_DELAY_MS = [700, 450, 200];
/** Where each of the top three stands, left to right: 2nd, 1st, 3rd. */
const PODIUM_ORDER = ['order-2', 'order-1', 'order-3'];

function Final({
  view,
  layout,
  gallery,
  socket,
  t,
}: {
  view: ScreenView;
  layout: ScreenLayout;
  gallery?: GalleryStore;
  socket?: GameSocket;
  t: Translate;
}) {
  const ranked = rankPlayers(view.players);
  const tonight = view.tonight;
  const withGallery = gallery !== undefined && view.gallery.length > 0;
  const hostActions = view.host !== null && socket !== undefined && view.rematchInMs === null;
  const left = (
    <div className="flex h-full flex-col gap-[2vmin]">
      {/* Portrait's gallery page has no height to spare, so the host's buttons go up here. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-[2vmin]">
        <h1 className="text-[max(6vmin,28px)] leading-tight">{t('finalTitle')}</h1>
        {hostActions && layout === 'portrait' && (
          <FinalHostActions view={view} socket={socket} t={t} />
        )}
      </div>
      {/* Tonight goes beside the podium on a wide Screen, under it on a narrower one. */}
      <div className="flex min-h-0 flex-1 flex-col gap-[2.5vmin] [@media(min-aspect-ratio:16/10)]:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-[2vmin]">
          <Podium top={ranked.slice(0, 3)} layout={layout} />
          <RestLine rest={ranked.slice(3)} layout={layout} />
        </div>
        {tonight && (
          <TonightPanel
            rows={tonight}
            games={view.gameNumber}
            // Once the gallery is up, a Screen too narrow for the Tonight column (4:3, portrait)
            // keeps it to one line, the night's top three, so the gallery keeps its height.
            strip={withGallery}
            // A page narrower than 16:10's (4:3, portrait) has room for two names beside the
            // heading; at 16:10 and wider the column lists eight.
            stripRows={2}
            t={t}
          />
        )}
      </div>
    </div>
  );
  const right = (
    <div className="flex h-full flex-col gap-[2vmin]">
      <ScreenAwards view={view} layout={layout} t={t} />
      {withGallery && <ScreenGallery view={view} gallery={gallery} t={t} />}
      {hostActions && layout === 'landscape' && (
        <FinalHostActions view={view} socket={socket} t={t} className="mt-auto" />
      )}
    </div>
  );
  return <ScreenDesk layout={layout} code={codeStripCode(view)} left={left} right={right} />;
}

/**
 * The top three on a drawn podium: crayon blocks with `ink` borders and hard shadows, 2nd, 1st and
 * 3rd from the left (listed 1st, 2nd, 3rd for screen readers), each as tall as its shared rank,
 * rising 3rd, then 2nd, then 1st. The medal stands on the block, so no white digit has to read on
 * a light crayon.
 */
function Podium({ top, layout }: { top: RankedPlayer[]; layout: ScreenLayout }) {
  const heights = BLOCK_HEIGHT[layout];
  return (
    <ol data-podium className="flex min-w-0 items-end justify-center gap-[2vmin]">
      {top.map(({ player, rank }, i) => (
        <li
          key={player.pid}
          data-podium-place={i + 1}
          className={`flex w-[22vmin] min-w-0 shrink flex-col items-center gap-[0.6vmin] motion-safe:animate-rise ${PODIUM_ORDER[i]}`}
          style={{ animationDelay: `${RISE_DELAY_MS[i]}ms` }}
        >
          {/* The block comes first, so a screen reader hears "1. Ana 1,840"; it stands last. */}
          <span
            data-block
            className="order-last grid w-full place-items-center border-[length:max(2px,0.35vmin)] border-ink text-[max(6vmin,28px)] shadow-[0.55vmin_0.55vmin_0_var(--color-ink)]"
            style={{ background: player.color, height: heights[rank - 1] ?? heights[2] }}
          >
            <span aria-hidden="true">{MEDALS[rank - 1]}</span>
            <span className="sr-only">{rank}.</span>
          </span>
          <Avatar
            player={player}
            size={layout === 'portrait' ? 'max(7vmin, 40px)' : 'max(9vmin, 44px)'}
          />
          <span
            className="w-full truncate text-center text-[max(3.6vmin,16px)] leading-tight"
            style={{ color: player.color }}
          >
            {player.name}
          </span>
          <span className="font-num text-[max(3vmin,14px)] font-black tabular-nums">
            {(player.score ?? 0).toLocaleString('en')}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * 4th and later on one line ("4. Bea 1,100 · 5. Carlo 760"); a full room wraps onto more rather
 * than shrink the names under 3.5 vh on a TV or cut anyone off.
 */
function RestLine({ rest, layout }: { rest: RankedPlayer[]; layout: ScreenLayout }) {
  if (rest.length === 0) return null;
  return (
    <ol
      data-rest
      // 3.6 vmin keeps names over 3.5 vh on a TV; a portrait tablet, read from 2 m, takes 3 vmin
      // so a full room wraps onto fewer lines and leaves the gallery its height.
      className={`flex shrink-0 flex-wrap justify-center gap-x-[1.2em] gap-y-[0.2em] leading-tight ${
        layout === 'portrait' ? 'text-[max(3vmin,15px)]' : 'text-[max(3.6vmin,16px)]'
      }`}
    >
      {rest.map(({ player, rank }) => (
        <li key={player.pid} className="flex min-w-0 items-baseline gap-[0.3em] whitespace-nowrap">
          <span className="font-num font-black text-soft tabular-nums">{rank}.</span>
          <span style={{ color: player.color }}>{player.name}</span>
          <span className="font-num font-black tabular-nums">
            {(player.score ?? 0).toLocaleString('en')}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The token Screen's Rematch (the highlighter) and Back to lobby (paper), sketch buttons, both two
 * taps as on the crown phone and in the host bar (each keeps its own arming): armed, a button
 * turns red pen and asks again.
 */
function FinalHostActions({
  view,
  socket,
  t,
  className = '',
}: {
  view: ScreenView;
  socket: GameSocket;
  t: Translate;
  className?: string;
}) {
  const { armed, tap, sending, status, statusIsHint } = useHostTaps(view, socket, t);
  const button = (control: ControlId, variant: 'primary' | 'ghost') => {
    const confirm = armed?.control === control ? CONFIRM_LABELS[control] : undefined;
    return (
      <button
        type="button"
        data-final-action={control}
        onClick={(e) => tap(control, e.timeStamp)}
        aria-disabled={sending === control}
        className={`${sketchButtonClass(confirm ? 'armed' : variant)} min-h-[max(7vmin,48px)] px-[3vmin] text-[max(3.4vmin,18px)] aria-disabled:opacity-70`}
      >
        {t(confirm ?? LABELS[control])}
      </button>
    );
  };
  return (
    <div className={`flex shrink-0 flex-wrap items-center gap-[2vmin] ${className}`}>
      {button('rematch', 'primary')}
      {button('backToLobby', 'ghost')}
      {/* Only what the server said takes room; the arm hint is for screen readers (the button
          already asks again). */}
      <p
        role="status"
        className={status && !statusIsHint ? 'text-[max(2.8vmin,14px)] text-red' : 'sr-only'}
      >
        {status ?? ''}
      </p>
    </div>
  );
}

// ---------- Tonight ----------

/** Rows the Tonight panel lists; the rest are counted in "+N more". */
const TONIGHT_ROWS = 8;

/**
 * The Tonight column's font size on a wide Screen: 3.2 vmin, or what fits `lines` rows (1.5em
 * each, 0.2em apart), the 1.25em heading and the 0.6em padding in the column's height.
 */
export function fitTonight(lines: number): string {
  return `min(max(3.2vmin, 16px), calc(100cqh / ${(3.2 + 1.7 * lines).toFixed(1)}))`;
}

/**
 * The night's totals (FINAL from game 2, as in Buzzr): shared ranks, players who left included.
 * A ruled index card: a column beside the podium on a wide Screen, its text sized to the column's
 * height; under it on a narrower one, a wrapped strip, or one line (`strip`) when the gallery
 * leaves no height (its two names going under the heading where they don't fit beside it).
 */
function TonightPanel({
  rows,
  games,
  strip,
  stripRows,
  t,
}: {
  rows: NonNullable<ScreenView['tonight']>;
  games: number;
  strip: boolean;
  /** Rows the one-line strip lists. */
  stripRows: number;
  t: Translate;
}) {
  const shown = rows.slice(0, TONIGHT_ROWS);
  const more = rows.length - shown.length;
  const stripMore = rows.length - stripRows;
  return (
    <div
      className={`w-full shrink-0 [@media(min-aspect-ratio:16/10)]:h-full [@media(min-aspect-ratio:16/10)]:w-[max(30vmin,180px)] [@media(min-aspect-ratio:16/10)]:[container-type:size]`}
      style={{ ['--tonight-size' as string]: fitTonight(shown.length + (more > 0 ? 1 : 0)) }}
    >
      <section
        aria-labelledby="tonight-title"
        data-tonight
        className={`flex flex-row items-baseline gap-x-[3vmin] gap-y-[0.5vmin] border-[length:max(2px,0.28vmin)] border-ink bg-paper px-[2vmin] shadow-[0.5vmin_0.5vmin_0_var(--color-ink)] [@media(min-aspect-ratio:16/10)]:max-h-full [@media(min-aspect-ratio:16/10)]:flex-col [@media(min-aspect-ratio:16/10)]:items-stretch [@media(min-aspect-ratio:16/10)]:gap-[0.3em] [@media(min-aspect-ratio:16/10)]:overflow-hidden [@media(min-aspect-ratio:16/10)]:py-[0.6em] [@media(min-aspect-ratio:16/10)]:text-[length:var(--tonight-size)] ${
          strip
            ? 'flex-wrap overflow-hidden py-[1.2vmin] text-[max(2.8vmin,14px)]'
            : 'flex-wrap py-[1.5vmin] text-[max(3.2vmin,16px)]'
        }`}
      >
        <h2
          id="tonight-title"
          className={`shrink-0 border-b-[length:max(2px,0.28vmin)] border-margin [@media(min-aspect-ratio:16/10)]:text-[1.25em] ${
            strip ? 'text-[max(3.4vmin,17px)]' : 'text-[max(4vmin,20px)]'
          }`}
        >
          {t('tonight', { n: games })}
        </h2>
        <ol
          className={`flex gap-x-[3vmin] gap-y-[0.5vmin] [@media(min-aspect-ratio:16/10)]:flex-col [@media(min-aspect-ratio:16/10)]:gap-[0.2em] ${
            strip ? 'max-w-full min-w-0 flex-nowrap overflow-hidden' : 'flex-wrap'
          }`}
        >
          {shown.map((row, i) => (
            <li
              key={row.pid}
              // In the strip, names truncate so "+N more" stays in view.
              className={`min-w-0 items-baseline gap-[1.5vmin] ${strip ? 'shrink overflow-hidden' : 'shrink-0'} ${
                strip && i >= stripRows ? `hidden [@media(min-aspect-ratio:16/10)]:flex` : 'flex'
              } [@media(min-aspect-ratio:16/10)]:border-b [@media(min-aspect-ratio:16/10)]:border-rule`}
            >
              <span
                className={`shrink-0 font-num font-black text-soft tabular-nums [@media(min-aspect-ratio:16/10)]:w-[1.6em] [@media(min-aspect-ratio:16/10)]:text-right`}
              >
                {row.rank}.
              </span>
              <span className="min-w-[2em] truncate" style={{ color: row.color }}>
                {row.name}
              </span>
              <span
                className={`font-num font-black tabular-nums [@media(min-aspect-ratio:16/10)]:ml-auto`}
              >
                {row.total.toLocaleString('en')}
              </span>
            </li>
          ))}
          {strip && stripMore > 0 && (
            <li className={`shrink-0 text-soft [@media(min-aspect-ratio:16/10)]:hidden`}>
              {t('andMore', { n: stripMore })}
            </li>
          )}
          {more > 0 && (
            <li
              className={`shrink-0 text-soft ${strip ? `hidden [@media(min-aspect-ratio:16/10)]:list-item` : ''}`}
            >
              {t('andMore', { n: more })}
            </li>
          )}
        </ol>
      </section>
    </div>
  );
}

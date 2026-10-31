import type { ScreenView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import type { ScreenGallery as GalleryStore } from '../../lib/gallery.js';
import { rankPlayers, type ScreenLayout } from '../../lib/screen.js';
import { Avatar } from '../Avatar.js';
import { ScreenAwards } from './ScreenAwards.js';
import { ScreenGallery } from './ScreenGallery.js';

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * SCOREBOARD and FINAL: the full ranking, in the server's shared ranks. From game 2, FINAL adds
 * the Tonight panel beside it, then Tonight's awards (F50), then the gallery (F49).
 */
export function ScreenStandings({
  view,
  layout,
  gallery,
  t,
}: {
  view: ScreenView;
  layout: ScreenLayout;
  /** FINAL's drawings; SCOREBOARD has none. */
  gallery?: GalleryStore;
  t: Translate;
}) {
  const ranked = rankPlayers(view.players);
  // Above six players, two columns (ranks run down the first, then the second) so ten fit a TV.
  const tonight = view.phase === 'FINAL' ? view.tonight : null;
  const withGallery = view.phase === 'FINAL' && gallery !== undefined && view.gallery.length > 0;
  // With the Tonight panel or the gallery, from four players, so all fit a 4:3 Screen too.
  // Portrait has the height for one column, and two would cut the names short.
  // SPEC-QUESTION: the spec draws standings for landscape only (DECISIONS 55).
  const compact = tonight !== null || withGallery;
  const twoColumns = layout === 'landscape' && ranked.length > (compact ? 3 : 6);
  const rows = Math.ceil(ranked.length / 2);
  // The size class stands in where container query units aren't supported (`fitRows` then fails).
  const [textSize, textClass] = withGallery
    ? ['max(3.6vmin, 17px)', 'text-[max(3.6vmin,17px)]']
    : tonight
      ? ['max(4vmin, 18px)', 'text-[max(4vmin,18px)]']
      : ['max(4.5vmin, 20px)', 'text-[max(4.5vmin,20px)]'];
  const rowGap = withGallery ? 0.5 : 1.5;
  const title =
    view.phase === 'FINAL'
      ? t('finalTitle')
      : t('roundDone', { cycle: view.turn?.cycle ?? 1, cycles: view.settings.cycles });
  return (
    <div
      className={`flex h-full flex-col items-center overflow-hidden px-[5vmin] ${
        withGallery ? 'gap-[2vmin] py-[2.5vmin]' : 'gap-[3vmin] py-[4vmin]'
      }`}
    >
      <h1
        className={`font-display font-bold ${
          withGallery ? 'text-[max(5.5vmin,26px)] leading-tight' : 'text-[max(7vmin,32px)]'
        }`}
      >
        {title}
      </h1>
      {/* Tonight goes beside the scores on a wide Screen, under them on a narrower one. */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-[3vmin] [@media(min-aspect-ratio:16/10)]:flex-row [@media(min-aspect-ratio:16/10)]:justify-center [@media(min-aspect-ratio:16/10)]:gap-[5vmin]">
        {/* The scores take the height the rest leaves (awards, gallery, Tonight): their text
            shrinks to fit it rather than run under what follows. Past a floor no Screen size
            reaches (DECISIONS 72) the box would scroll rather than overlap. */}
        <div className="min-h-0 w-full flex-1 overflow-y-auto [container-type:size] [scrollbar-width:thin] [@media(min-aspect-ratio:16/10)]:h-full">
          <ol
            className={`mx-auto grid w-full gap-x-[5vmin] ${textClass} ${twoColumns ? 'grid-flow-col grid-cols-2' : ''}`}
            style={{
              ...(twoColumns ? { gridTemplateRows: `repeat(${rows}, auto)` } : {}),
              maxWidth: twoColumns ? (tonight ? '110vmin' : '160vmin') : '80vmin',
              rowGap: `${rowGap}vmin`,
              fontSize: fitRows(textSize, twoColumns ? rows : ranked.length, rowGap),
            }}
          >
            {ranked.map(({ player, rank }) => (
              <li
                key={player.pid}
                className={`flex min-w-0 items-center gap-[2vmin] rounded-[1.5vmin] px-[2vmin] py-[0.25em] ${
                  rank === 1 ? 'bg-white/10' : ''
                }`}
              >
                <span className="w-[2em] text-center tabular-nums">
                  {MEDALS[rank - 1] ? (
                    <>
                      <span aria-hidden="true">{MEDALS[rank - 1]}</span>
                      <span className="sr-only">{rank}.</span>
                    </>
                  ) : (
                    `${rank}.`
                  )}
                </span>
                <Avatar player={player} size="1.5em" />
                <span className="truncate font-semibold" style={{ color: player.color }}>
                  {player.name}
                </span>
                <span className="ml-auto font-bold tabular-nums">
                  {(player.score ?? 0).toLocaleString('en')}
                </span>
              </li>
            ))}
          </ol>
        </div>
        {tonight && (
          <TonightPanel
            rows={tonight}
            games={view.gameNumber}
            // A landscape Screen too narrow for the Tonight column has no height for a wrapped
            // strip once the gallery is up: one line, the night's top three.
            strip={withGallery && layout === 'landscape'}
            t={t}
          />
        )}
      </div>
      {view.phase === 'FINAL' && <ScreenAwards view={view} layout={layout} t={t} />}
      {withGallery && (
        <ScreenGallery
          view={view}
          gallery={gallery}
          // Up to six players in one column leave the height for bigger drawings; portrait always.
          large={layout === 'portrait' || (!tonight && ranked.length <= 6)}
          t={t}
        />
      )}
    </div>
  );
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

/** Rows the Tonight panel lists; the rest are counted in "+N more". */
const TONIGHT_ROWS = 8;
/** Rows the one-line strip lists. */
const TONIGHT_STRIP_ROWS = 3;

/**
 * The Tonight column's font size on a wide Screen: 3.2 vmin, or what fits `lines` rows (1.5em
 * each, 0.2em apart), the 1.25em heading and the 0.6em padding in the column's height.
 */
export function fitTonight(lines: number): string {
  return `min(max(3.2vmin, 16px), calc(100cqh / ${(3.2 + 1.7 * lines).toFixed(1)}))`;
}

/**
 * The night's totals (FINAL from game 2, as in Buzzr): shared ranks, players who left included.
 * A column beside the scores on a wide Screen, its text sized to the column's height; under them
 * on a narrower one, a wrapped strip, or one line (`strip`) when the gallery leaves no height.
 */
function TonightPanel({
  rows,
  games,
  strip,
  t,
}: {
  rows: NonNullable<ScreenView['tonight']>;
  games: number;
  strip: boolean;
  t: Translate;
}) {
  const shown = rows.slice(0, TONIGHT_ROWS);
  const more = rows.length - shown.length;
  const stripMore = rows.length - TONIGHT_STRIP_ROWS;
  return (
    <div
      className={`w-full max-w-[110vmin] shrink-0 [@media(min-aspect-ratio:16/10)]:h-full [@media(min-aspect-ratio:16/10)]:w-[max(44vmin,220px)] [@media(min-aspect-ratio:16/10)]:max-w-none [@media(min-aspect-ratio:16/10)]:[container-type:size]`}
      style={{ ['--tonight-size' as string]: fitTonight(shown.length + (more > 0 ? 1 : 0)) }}
    >
      <section
        aria-labelledby="tonight-title"
        className={`flex flex-row items-baseline gap-x-[3vmin] gap-y-[0.5vmin] rounded-[2vmin] bg-white/5 px-[2.5vmin] [@media(min-aspect-ratio:16/10)]:flex-col [@media(min-aspect-ratio:16/10)]:items-stretch [@media(min-aspect-ratio:16/10)]:gap-[0.3em] [@media(min-aspect-ratio:16/10)]:overflow-hidden [@media(min-aspect-ratio:16/10)]:py-[0.6em] [@media(min-aspect-ratio:16/10)]:text-[length:var(--tonight-size)] ${
          strip
            ? 'overflow-hidden py-[1.2vmin] text-[max(2.8vmin,14px)]'
            : 'flex-wrap py-[2vmin] text-[max(3.2vmin,16px)]'
        }`}
      >
        <h2
          id="tonight-title"
          className={`shrink-0 font-display font-bold [@media(min-aspect-ratio:16/10)]:text-[1.25em] ${
            strip ? 'text-[max(3.4vmin,17px)]' : 'text-[max(4vmin,20px)]'
          }`}
        >
          {t('tonight', { n: games })}
        </h2>
        <ol
          className={`flex gap-x-[3vmin] gap-y-[0.5vmin] [@media(min-aspect-ratio:16/10)]:flex-col [@media(min-aspect-ratio:16/10)]:gap-[0.2em] ${
            strip ? 'min-w-0 flex-nowrap' : 'flex-wrap'
          }`}
        >
          {shown.map((row, i) => (
            <li
              key={row.pid}
              // In the strip, names truncate so "+N more" stays in view.
              className={`min-w-0 items-baseline gap-[1.5vmin] ${strip ? 'shrink' : 'shrink-0'} ${
                strip && i >= TONIGHT_STRIP_ROWS
                  ? `hidden [@media(min-aspect-ratio:16/10)]:flex`
                  : 'flex'
              }`}
            >
              <span
                className={`shrink-0 text-white/70 tabular-nums [@media(min-aspect-ratio:16/10)]:w-[1.6em] [@media(min-aspect-ratio:16/10)]:text-right`}
              >
                {row.rank}.
              </span>
              <span className="truncate font-semibold" style={{ color: row.color }}>
                {row.name}
              </span>
              <span className={`font-bold tabular-nums [@media(min-aspect-ratio:16/10)]:ml-auto`}>
                {row.total.toLocaleString('en')}
              </span>
            </li>
          ))}
          {strip && stripMore > 0 && (
            <li className={`shrink-0 text-white/70 [@media(min-aspect-ratio:16/10)]:hidden`}>
              {t('andMore', { n: stripMore })}
            </li>
          )}
          {more > 0 && (
            <li
              className={`shrink-0 text-white/70 ${strip ? `hidden [@media(min-aspect-ratio:16/10)]:list-item` : ''}`}
            >
              {t('andMore', { n: more })}
            </li>
          )}
        </ol>
      </section>
    </div>
  );
}

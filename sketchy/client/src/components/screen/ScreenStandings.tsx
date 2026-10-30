import type { ScreenView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import { rankPlayers } from '../../lib/screen.js';
import { Avatar } from './PlayerChip.js';

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * SCOREBOARD and FINAL: the full ranking, in the server's shared ranks. From game 2, FINAL adds
 * the Tonight panel beside it. The gallery and awards arrive with F49 and F50.
 */
export function ScreenStandings({ view, t }: { view: ScreenView; t: Translate }) {
  const ranked = rankPlayers(view.players);
  // Above six players, two columns (ranks run down the first, then the second) so ten fit a TV.
  const tonight = view.phase === 'FINAL' ? view.tonight : null;
  // With the Tonight panel beside or under it, from four players, so both fit a 4:3 Screen too.
  const twoColumns = ranked.length > (tonight ? 3 : 6);
  const rows = Math.ceil(ranked.length / 2);
  const title =
    view.phase === 'FINAL'
      ? t('finalTitle')
      : t('roundDone', { cycle: view.turn?.cycle ?? 1, cycles: view.settings.cycles });
  return (
    <div className="flex h-full flex-col items-center gap-[3vmin] overflow-hidden px-[5vmin] py-[4vmin]">
      <h1 className="font-display text-[max(7vmin,32px)] font-bold">{title}</h1>
      {/* Tonight goes beside the scores on a wide Screen, under them on a narrower one. */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-[3vmin] [@media(min-aspect-ratio:16/10)]:flex-row [@media(min-aspect-ratio:16/10)]:items-start [@media(min-aspect-ratio:16/10)]:justify-center [@media(min-aspect-ratio:16/10)]:gap-[5vmin]">
        <ol
          className={`grid min-h-0 w-full gap-x-[5vmin] gap-y-[1.5vmin] ${
            tonight ? 'text-[max(4vmin,18px)]' : 'text-[max(4.5vmin,20px)]'
          } ${
            twoColumns
              ? `${tonight ? 'max-w-[110vmin]' : 'max-w-[160vmin]'} grid-flow-col grid-cols-2`
              : 'max-w-[80vmin]'
          }`}
          style={twoColumns ? { gridTemplateRows: `repeat(${rows}, auto)` } : undefined}
        >
          {ranked.map(({ player, rank }) => (
            <li
              key={player.pid}
              className={`flex min-w-0 items-center gap-[2vmin] rounded-[1.5vmin] px-[2vmin] py-[1vmin] ${
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
        {tonight && <TonightPanel rows={tonight} games={view.gameNumber} t={t} />}
      </div>
    </div>
  );
}

/** Rows the Tonight panel lists; the rest are counted in "+N more". */
const TONIGHT_ROWS = 8;

/**
 * The night's totals (FINAL from game 2, as in Buzzr): shared ranks, players who left included.
 * A column beside the scores on a wide Screen; a wrapped strip under them on a narrower one.
 */
function TonightPanel({
  rows,
  games,
  t,
}: {
  rows: NonNullable<ScreenView['tonight']>;
  games: number;
  t: Translate;
}) {
  return (
    <section
      aria-labelledby="tonight-title"
      className="flex w-full max-w-[110vmin] shrink-0 flex-row flex-wrap items-baseline gap-x-[3vmin] gap-y-[0.5vmin] rounded-[2vmin] bg-white/5 px-[2.5vmin] py-[2vmin] text-[max(3.2vmin,16px)] [@media(min-aspect-ratio:16/10)]:w-[max(44vmin,220px)] [@media(min-aspect-ratio:16/10)]:max-w-none [@media(min-aspect-ratio:16/10)]:flex-col [@media(min-aspect-ratio:16/10)]:items-stretch [@media(min-aspect-ratio:16/10)]:gap-[1vmin]"
    >
      <h2 id="tonight-title" className="font-display text-[max(4vmin,20px)] font-bold">
        {t('tonight', { n: games })}
      </h2>
      <ol className="flex flex-wrap gap-x-[3vmin] gap-y-[0.5vmin] [@media(min-aspect-ratio:16/10)]:flex-col [@media(min-aspect-ratio:16/10)]:gap-[0.6vmin]">
        {rows.slice(0, TONIGHT_ROWS).map((row) => (
          <li key={row.pid} className="flex min-w-0 items-baseline gap-[1.5vmin]">
            <span className="shrink-0 text-white/70 tabular-nums [@media(min-aspect-ratio:16/10)]:w-[1.6em] [@media(min-aspect-ratio:16/10)]:text-right">
              {row.rank}.
            </span>
            <span className="truncate font-semibold" style={{ color: row.color }}>
              {row.name}
            </span>
            <span className="font-bold tabular-nums [@media(min-aspect-ratio:16/10)]:ml-auto">
              {row.total.toLocaleString('en')}
            </span>
          </li>
        ))}
        {rows.length > TONIGHT_ROWS && (
          <li className="text-white/70">{t('andMore', { n: rows.length - TONIGHT_ROWS })}</li>
        )}
      </ol>
    </section>
  );
}

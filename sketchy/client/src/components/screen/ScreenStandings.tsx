import type { ScreenView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import { rankPlayers } from '../../lib/screen.js';
import { Avatar } from './PlayerChip.js';

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * SCOREBOARD and FINAL: the full ranking, in the server's shared ranks. The gallery and awards
 * arrive with F29+.
 */
export function ScreenStandings({ view, t }: { view: ScreenView; t: Translate }) {
  const ranked = rankPlayers(view.players);
  // Above six players, two columns (ranks run down the first, then the second) so ten fit a TV.
  const twoColumns = ranked.length > 6;
  const rows = Math.ceil(ranked.length / 2);
  const title =
    view.phase === 'FINAL'
      ? t('finalTitle')
      : t('roundDone', { cycle: view.turn?.cycle ?? 1, cycles: view.settings.cycles });
  return (
    <div className="flex h-full flex-col items-center gap-[3vmin] overflow-hidden px-[5vmin] py-[4vmin]">
      <h1 className="font-display text-[max(7vmin,32px)] font-bold">{title}</h1>
      <ol
        className={`grid min-h-0 w-full gap-x-[5vmin] gap-y-[1.5vmin] text-[max(4.5vmin,20px)] ${
          twoColumns ? 'max-w-[160vmin] grid-flow-col grid-cols-2' : 'max-w-[80vmin]'
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
            <Avatar player={player} size="1.2em" />
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
  );
}

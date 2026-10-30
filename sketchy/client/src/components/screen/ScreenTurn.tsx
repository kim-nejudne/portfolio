import type { PlayerChipView, ScreenView, TurnView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import type { ScreenInk } from '../../lib/ink.js';
import {
  formatClock,
  hasCaptionRow,
  hintLetters,
  turnCaption,
  wordLengths,
} from '../../lib/screen.js';
import { useCountdown } from '../../lib/useCountdown.js';
import { InkCanvas } from './InkCanvas.js';
import { Avatar } from './PlayerChip.js';

/** CHOOSING, DRAWING and REVEAL (landscape): the square drawing on the left, the sidebar right. */
export function ScreenTurn({
  view,
  receivedAt,
  ink,
  t,
}: {
  view: ScreenView;
  receivedAt: number;
  ink: ScreenInk;
  t: Translate;
}) {
  const turn = view.turn;
  if (!turn) return null;
  const drawer = view.players.find((p) => p.pid === turn.drawerPid);
  const caption = turnCaption(view, t);
  const captionRow = hasCaptionRow(turn);
  return (
    <div className="flex h-full min-h-0 gap-[2vmin] p-[2vmin]">
      <div className="flex h-full shrink-0 flex-col gap-[1vmin]">
        {/* In the first two turns the square gives up the caption's row. */}
        <div
          className="relative aspect-square h-full max-w-[72vw] shrink-0"
          style={captionRow ? { height: `calc(100% - ${CAPTION_HEIGHT} - 1vmin)` } : undefined}
        >
          <InkCanvas ink={ink} />
          {view.phase === 'CHOOSING' && (
            <div className="absolute inset-0 grid place-items-center rounded-[1vmin] bg-[#1D1B22]/85 p-[4vmin] text-center">
              <p
                className="font-display text-[max(6vmin,28px)] font-bold"
                style={{ color: drawer?.color }}
              >
                {t('isChoosing', { name: turn.drawerName })}
              </p>
            </div>
          )}
        </div>
        {captionRow && <Caption text={caption} />}
      </div>
      <aside className="@container flex min-w-[28vw] flex-1 flex-col gap-[2vmin] overflow-hidden text-[max(3.5vh,16px)]">
        {view.phase === 'REVEAL' ? (
          <RevealPanel view={view} turn={turn} t={t} />
        ) : (
          <TurnPanel view={view} turn={turn} receivedAt={receivedAt} t={t} />
        )}
      </aside>
    </div>
  );
}

/** Two lines of names-sized text (3.5 vh) with their line height. */
const CAPTION_HEIGHT = 'max(9vh, 44px)';

/**
 * The first two turns' caption, under the drawing and never over it (Screen, Drawing). As wide as
 * the square (`w-0 min-w-full` keeps the text from widening the column) and at most two lines.
 * Empty outside DRAWING, keeping its row.
 */
export function Caption({ text }: { text: string | null }) {
  return (
    <div className="@container w-0 min-w-full shrink-0" style={{ height: CAPTION_HEIGHT }}>
      {/* About 32 characters a line: the text shrinks when the square is narrow (a near-square
          Screen caps it at 72 vw), so the first turn's caption stays on two lines. */}
      <p className="line-clamp-2 text-center text-[min(max(3.5vh,16px),5.5cqw)] leading-tight font-semibold text-[#FFD166]">
        {text}
      </p>
    </div>
  );
}

function TurnPanel({
  view,
  turn,
  receivedAt,
  t,
}: {
  view: ScreenView;
  turn: TurnView;
  receivedAt: number;
  t: Translate;
}) {
  const left = useCountdown(turn.timer, receivedAt);
  const urgent = view.phase === 'DRAWING' && left <= 10_000;
  const names = new Map(view.players.map((p) => [p.pid, p]));
  return (
    <>
      <p
        className={`font-display text-[max(9vmin,40px)] leading-none font-bold tabular-nums ${urgent ? 'text-[#FF6B35]' : ''}`}
        role="timer"
      >
        <span aria-hidden>◔</span> {formatClock(left)}
      </p>
      {turn.mask && <Blanks mask={turn.mask} />}
      <p className="text-white/70">
        {t('roundTurn', { cycle: turn.cycle, cycles: view.settings.cycles, turn: turn.number })}
      </p>
      {view.phase === 'DRAWING' && <p>{t('isDrawing', { name: turn.drawerName })}</p>}
      <hr className="border-white/20" />
      <PlayerList players={view.players} />
      {view.feed.length > 0 && (
        <>
          <hr className="shrink-0 border-white/20" />
          <ul className="flex shrink-0 flex-col gap-[0.5vmin] text-white/80">
            {/* Above six players the list takes two columns and the feed keeps its two latest. */}
            {view.feed.slice(view.players.length > 6 ? -2 : -4).map((g, i) => (
              <li key={i} className="truncate">
                <span style={{ color: names.get(g.pid)?.color }}>{names.get(g.pid)?.name}</span>:{' '}
                {g.text ?? '•••'}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** The blanks, one cell per character, with the letters per word after them: `(5, 4)`. */
export function Blanks({ mask }: { mask: string[] }) {
  const lengths = wordLengths(mask);
  const hints = hintLetters(mask);
  const words = mask.join('').split(' ');
  // Shrinks with the phrase to stay on one line in the sidebar (each cell is about 0.9 em with its
  // gap, plus about 4 em for the counts), but never below 3.5 vh: a long phrase wraps between
  // words instead.
  const fontSize = `max(3.5vh, min(6vmin, calc(100cqw / ${(mask.length * 0.9 + 4).toFixed(1)})))`;
  return (
    <p
      className="flex shrink-0 flex-wrap items-baseline gap-x-[0.9em] gap-y-[0.2em] font-bold"
      style={{ fontSize }}
      aria-label={`${lengths.join(', ')} letters${hints.length ? `. Hints: ${hints.join(', ')}` : ''}`}
    >
      {words.map((word, w) => (
        <span key={w} className="flex gap-[0.3em] font-mono whitespace-nowrap">
          {[...word].map((ch, i) => (
            <span key={i}>{ch}</span>
          ))}
        </span>
      ))}
      <span className="text-[max(3.5vh,0.6em)] font-normal whitespace-nowrap text-white/70">
        ({lengths.join(', ')})
      </span>
    </p>
  );
}

/**
 * Players in turn order with ✏️ on the drawer and ✓ with this turn's points. No totals. Above six
 * players the list goes to two columns (top to bottom, then the next column) so ten still fit.
 */
function PlayerList({ players }: { players: PlayerChipView[] }) {
  const twoColumns = players.length > 6;
  return (
    <ul
      className={`grid min-h-0 shrink gap-x-[2vmin] overflow-hidden ${twoColumns ? 'grid-flow-col grid-cols-2 gap-y-[0.4vmin] text-[0.9em]' : 'gap-y-[0.8vmin]'}`}
      style={
        twoColumns
          ? { gridTemplateRows: `repeat(${Math.ceil(players.length / 2)}, auto)` }
          : undefined
      }
    >
      {players.map((p) => (
        <li
          key={p.pid}
          className={`flex min-w-0 items-center gap-[1vmin] ${p.connected ? '' : 'opacity-60'}`}
        >
          <span className="w-[1.2em] text-center">{p.isDrawer ? '✏️' : p.guessed ? '✓' : ''}</span>
          <Avatar player={p} size="1.2em" />
          <span className="truncate font-semibold" style={{ color: p.color }}>
            {p.name}
          </span>
          {p.guessed && p.turnPoints > 0 && (
            <span className="ml-auto pr-[1vmin] tabular-nums">+{p.turnPoints}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The word, as the largest text on screen: 12 vh, scaled down only as far as its longest word
 * needs to fit the sidebar on one line (an uppercase bold letter is about 0.75 em). It wraps
 * between words, never inside one.
 */
function RevealWord({ word }: { word: string }) {
  const longest = Math.max(...word.split(/\s+/).map((w) => [...w].length));
  return (
    <p
      className="font-display leading-none font-bold text-[#FF6B35] uppercase"
      style={{ fontSize: `min(12vh, calc(100cqw / ${(longest * 0.75).toFixed(2)}))` }}
    >
      {word}
    </p>
  );
}

export function RevealPanel({ view, turn, t }: { view: ScreenView; turn: TurnView; t: Translate }) {
  const byPid = new Map(view.players.map((p) => [p.pid, p]));
  const drawer = byPid.get(turn.drawerPid);
  const correct = [...turn.correct].sort((a, b) => a.order - b.order);
  return (
    <>
      {turn.endReason === 'allGuessed' && (
        <p className="font-display text-[max(5vmin,24px)] font-bold text-[#2DC653]">
          {t('everyoneGotIt')} <span aria-hidden="true">🎉</span>
        </p>
      )}
      <p className="text-white/70">{t('itWas')}</p>
      {turn.word && <RevealWord word={turn.word} />}
      {correct.length === 0 ? (
        <p className="font-display text-[max(5vmin,24px)] font-bold">{t('nobodyGotIt')}</p>
      ) : (
        <div className="flex flex-col gap-[0.8vmin]">
          <p className="text-white/70">{t('gotItLabel')}</p>
          <ul className="flex flex-wrap gap-x-[2vmin] gap-y-[0.8vmin]">
            {correct.map((c) => {
              const p = byPid.get(c.pid);
              return (
                <li key={c.pid} className="flex items-center gap-[0.8vmin]">
                  {p && <Avatar player={p} size="1.1em" />}
                  <span style={{ color: p?.color }}>{p?.name}</span>
                  <span className="tabular-nums">+{c.points}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {view.closeGuesses.length > 0 && (
        <p className="text-white/80">
          {t('almost')} {view.closeGuesses.map((g) => g.text ?? '•••').join(' · ')}
        </p>
      )}
      {drawer && drawer.turnPoints > 0 && (
        <p>{t('drawerPoints', { points: drawer.turnPoints, name: drawer.name })}</p>
      )}
    </>
  );
}

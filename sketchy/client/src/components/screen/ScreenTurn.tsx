import { FEED_MAX } from '../../../../shared/constants.js';
import type { PlayerChipView, ScreenView, TurnView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import type { ScreenInk } from '../../lib/ink.js';
import {
  formatClock,
  hasCaptionRow,
  hintLetters,
  turnCaption,
  wordLengths,
  type ScreenLayout,
} from '../../lib/screen.js';
import { NO_FX, type ScreenFxState } from '../../lib/screenFx.js';
import { useCountdown } from '../../lib/useCountdown.js';
import { InkCanvas } from './InkCanvas.js';
import { Avatar } from './PlayerChip.js';
import { GotItLine, TurnFx } from './TurnFx.js';

/**
 * CHOOSING, DRAWING and REVEAL. Landscape (near-square too): the square drawing on the left at the
 * full height, at most 72 vw so the sidebar keeps its 28 %, and the sidebar right. Portrait: a top
 * bar, the full-width square, then the players strip and the two latest guesses.
 */
export function ScreenTurn({
  view,
  receivedAt,
  ink,
  layout,
  fx = NO_FX,
  t,
}: {
  view: ScreenView;
  receivedAt: number;
  ink: ScreenInk;
  layout: ScreenLayout;
  /** "Jun got it!", bubbles and reactions, from `fx` events. */
  fx?: ScreenFxState;
  t: Translate;
}) {
  const turn = view.turn;
  if (!turn) return null;
  if (layout === 'portrait')
    return <PortraitTurn view={view} turn={turn} receivedAt={receivedAt} ink={ink} fx={fx} t={t} />;
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
          <Drawing view={view} turn={turn} ink={ink} t={t} />
        </div>
        {captionRow && <Caption text={caption} />}
      </div>
      <aside className="@container relative flex min-w-[28vw] flex-1 flex-col gap-[2vmin] overflow-hidden text-[max(3.5vh,16px)]">
        {view.phase === 'REVEAL' ? (
          <RevealPanel view={view} turn={turn} t={t} />
        ) : (
          <TurnPanel view={view} turn={turn} receivedAt={receivedAt} fx={fx} t={t} />
        )}
        <TurnFx
          fx={fx}
          players={view.players}
          guessFeed={view.settings.guessFeed}
          layout="landscape"
          t={t}
        />
      </aside>
    </div>
  );
}

/** The live drawing, and over it while the drawer is still choosing, who is choosing. */
function Drawing({
  view,
  turn,
  ink,
  t,
}: {
  view: ScreenView;
  turn: TurnView;
  ink: ScreenInk;
  t: Translate;
}) {
  const drawer = view.players.find((p) => p.pid === turn.drawerPid);
  return (
    <>
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
    </>
  );
}

/**
 * The least room under the portrait square, for the players strip and two guesses, and at the
 * reveal for the reveal panel. It never depends on what's in it, so the drawing keeps its size
 * through the turn.
 */
// SPEC-QUESTION: the spec doesn't size the portrait strip or say where the reveal goes; a fixed
// reserve under the square holds both (DECISIONS 55).
const PORTRAIT_BELOW = 'max(25vh, 180px)';

/**
 * Portrait (a portrait tablet or a propped-up phone): the timer and blanks in a top bar, the
 * full-width square (smaller only when the height runs out), then the players with ✏️ and ✓ and
 * the two latest guesses. Round and turn numbers are dropped. At the reveal the top bar says
 * "It was…" and the word takes the strip's place under the drawing.
 */
function PortraitTurn({
  view,
  turn,
  receivedAt,
  ink,
  fx,
  t,
}: {
  view: ScreenView;
  turn: TurnView;
  receivedAt: number;
  ink: ScreenInk;
  fx: ScreenFxState;
  t: Translate;
}) {
  const caption = turnCaption(view, t);
  const captionRow = hasCaptionRow(turn);
  const reveal = view.phase === 'REVEAL';
  return (
    <div className="@container flex h-full min-h-0 flex-col gap-[1.5vmin] px-[2vmin] pt-[2vmin] text-[max(3.5vmin,16px)]">
      <header className="flex min-h-[max(9vmin,40px)] shrink-0 items-center gap-[3vmin]">
        {reveal ? (
          <RevealIntro turn={turn} t={t} />
        ) : (
          <TopBar view={view} turn={turn} receivedAt={receivedAt} fx={fx} t={t} />
        )}
      </header>
      {/* The square is as wide as the Screen unless the height runs out first; it takes the free
          height before the strip does (the weights), up to its width (100cqw). */}
      <div className="grid max-h-[100cqw] min-h-0 flex-[1000_1_0%] place-items-center [container-type:size]">
        <div className="relative aspect-square w-[min(100cqw,100cqh)]">
          <Drawing view={view} turn={turn} ink={ink} t={t} />
        </div>
      </div>
      {/* The caption's row (first two turns) is part of this room, so the reveal can use it. */}
      <section
        className="@container relative flex flex-[1_0_0%] flex-col gap-[1.2vmin] overflow-hidden leading-tight"
        style={{
          minHeight: captionRow
            ? `calc(${PORTRAIT_BELOW} + ${PORTRAIT_CAPTION_HEIGHT} + 1.2vmin)`
            : PORTRAIT_BELOW,
        }}
      >
        {reveal ? (
          <RevealPanel view={view} turn={turn} t={t} layout="portrait" />
        ) : (
          <>
            {captionRow && <Caption text={caption} layout="portrait" />}
            <PlayerStrip players={view.players} />
            <Feed view={view} latest={2} />
          </>
        )}
        <TurnFx
          fx={fx}
          players={view.players}
          guessFeed={view.settings.guessFeed}
          layout="portrait"
          t={t}
        />
      </section>
    </div>
  );
}

/**
 * The portrait top bar: the clock and the blanks on one line. "Jun got it!" takes the blanks' place
 * for its 2 s: the bar has no room for both, and the drawing must stay clear.
 */
function TopBar({
  view,
  turn,
  receivedAt,
  fx,
  t,
}: {
  view: ScreenView;
  turn: TurnView;
  receivedAt: number;
  fx: ScreenFxState;
  t: Translate;
}) {
  const left = useCountdown(turn.timer, receivedAt);
  const urgent = view.phase === 'DRAWING' && left <= 10_000;
  return (
    <>
      <p
        className={`font-display shrink-0 text-[max(8vmin,36px)] leading-none font-bold tabular-nums ${urgent ? 'text-[#FF6B35]' : ''}`}
        role="timer"
      >
        <span aria-hidden>◔</span> {formatClock(left)}
      </p>
      {/* The live region stays mounted through the turn, so each "got it" is announced. */}
      <div className="@container min-w-0 flex-1" role="status" aria-live="polite">
        {/* SPEC-QUESTION: the portrait top bar holds the clock and blanks; the announcement
            stands in for the blanks while it shows (DECISIONS 56). */}
        {view.phase === 'DRAWING' && fx.gotIt.length > 0 ? (
          <GotItLine
            gotIt={fx.gotIt}
            players={view.players}
            className="text-[max(5vmin,22px)]"
            t={t}
          />
        ) : (
          turn.mask && <Blanks mask={turn.mask} minSize="max(3.5vmin, 16px)" />
        )}
      </div>
    </>
  );
}

/**
 * Portrait players: one wrapped strip in turn order, ✏️ on the drawer, ✓ and this turn's points
 * after a correct guess, no totals.
 */
function PlayerStrip({ players }: { players: PlayerChipView[] }) {
  return (
    <ul className="flex min-h-0 flex-wrap content-start gap-x-[3vmin] gap-y-[1vmin] overflow-hidden">
      {players.map((p) => (
        <li
          key={p.pid}
          data-chip={p.pid}
          className={`flex max-w-full min-w-0 items-center gap-[0.8vmin] rounded-[0.6vmin] px-[0.6vmin] ${p.guessed ? LIT : ''} ${p.connected ? '' : 'opacity-60'}`}
        >
          {(p.isDrawer || p.guessed) && <span>{p.isDrawer ? '✏️' : '✓'}</span>}
          <Avatar player={p} size="1.4em" />
          <span className="truncate font-semibold" style={{ color: p.color }}>
            {p.name}
          </span>
          {p.guessed && p.turnPoints > 0 && <span className="tabular-nums">+{p.turnPoints}</span>}
        </li>
      ))}
    </ul>
  );
}

/** A correct guesser's chip stays lit for the rest of the turn (every chip has its padding, so lighting one moves nothing). */
const LIT = 'bg-[#2DC653]/20';

/**
 * The latest guesses, newest last, in the guesser's colour ("•••" for a masked one). `fill`: up to
 * the last 8 right under the players; when the height runs out the feed gives way first (never
 * below two lines), the oldest cut off at the top.
 */
function Feed({
  view,
  latest,
  fill = false,
}: {
  view: ScreenView;
  latest: number;
  fill?: boolean;
}) {
  if (view.feed.length === 0) return null;
  const names = new Map(view.players.map((p) => [p.pid, p]));
  return (
    <ul
      className={`flex flex-col gap-[0.5vmin] text-white/80 ${
        fill
          ? 'min-h-[calc(2lh+0.5vmin)] shrink-[100] justify-end overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_1.2em)]'
          : 'shrink-0'
      }`}
    >
      {view.feed.slice(-latest).map((g, i) => (
        <li key={i} className="shrink-0 truncate">
          <span style={{ color: names.get(g.pid)?.color }}>{names.get(g.pid)?.name}</span>:{' '}
          {g.text ?? '•••'}
        </li>
      ))}
    </ul>
  );
}

/** Two lines of names-sized text (3.5 vh) with their line height. */
const CAPTION_HEIGHT = 'max(9vh, 44px)';
/** Portrait: two lines at the portrait text size (3.5 vmin). */
const PORTRAIT_CAPTION_HEIGHT = 'max(9vmin, 42px)';

/**
 * The first two turns' caption, under the drawing and never over it (Screen, Drawing). As wide as
 * the square (`w-0 min-w-full` keeps the text from widening the column) and at most two lines.
 * Empty outside DRAWING, keeping its row.
 */
export function Caption({
  text,
  layout = 'landscape',
}: {
  text: string | null;
  layout?: ScreenLayout;
}) {
  const portrait = layout === 'portrait';
  return (
    <div
      className="@container w-0 min-w-full shrink-0"
      style={{ height: portrait ? PORTRAIT_CAPTION_HEIGHT : CAPTION_HEIGHT }}
    >
      {/* About 32 characters a line: the text shrinks when the square is narrow (a near-square
          Screen caps it at 72 vw), so the first turn's caption stays on two lines. */}
      <p
        className={`line-clamp-2 text-center leading-tight font-semibold text-[#FFD166] ${
          portrait ? 'text-[min(max(3.5vmin,16px),5.5cqw)]' : 'text-[min(max(3.5vh,16px),5.5cqw)]'
        }`}
      >
        {text}
      </p>
    </div>
  );
}

function TurnPanel({
  view,
  turn,
  receivedAt,
  fx,
  t,
}: {
  view: ScreenView;
  turn: TurnView;
  receivedAt: number;
  fx: ScreenFxState;
  t: Translate;
}) {
  const left = useCountdown(turn.timer, receivedAt);
  const urgent = view.phase === 'DRAWING' && left <= 10_000;
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
      {/* "Jun got it!" stands in for "Mika is drawing" for its 2 s, on the same line. */}
      {view.phase === 'DRAWING' && (
        // One live region for the whole turn, so each "got it" is announced.
        <div role="status" aria-live="polite">
          {fx.gotIt.length > 0 ? (
            <GotItLine gotIt={fx.gotIt} players={view.players} t={t} />
          ) : (
            <p className="truncate">{t('isDrawing', { name: turn.drawerName })}</p>
          )}
        </div>
      )}
      <hr className="border-white/20" />
      <PlayerList players={view.players} />
      {view.feed.length > 0 && (
        <>
          <hr className="shrink-0 border-white/20" />
          {/* The last 8 in the height left: at least two lines under ten players in two columns. */}
          <Feed view={view} latest={FEED_MAX} fill />
        </>
      )}
    </>
  );
}

const LETTER = /[\p{L}\p{N}]/u;

/** The blanks, one cell per character, with the letters per word after them: `(5, 4)`. */
export function Blanks({ mask, minSize = '3.5vh' }: { mask: string[]; minSize?: string }) {
  const lengths = wordLengths(mask);
  const hints = hintLetters(mask);
  const words = mask.join('').split(' ');
  // Shrinks with the phrase to stay on one line in the sidebar (each cell is about 0.9 em with its
  // gap, plus about 4 em for the counts), but never below `minSize` (3.5 vh, names-sized on a TV):
  // a long phrase wraps between words instead.
  const fontSize = `max(${minSize}, min(6vmin, calc(100cqw / ${(mask.length * 0.9 + 4).toFixed(1)})))`;
  return (
    <p
      className="flex shrink-0 flex-wrap items-baseline gap-x-[0.9em] gap-y-[0.2em] font-bold"
      style={{ fontSize }}
      aria-label={`${lengths.join(', ')} letters${hints.length ? `. Hints: ${hints.join(', ')}` : ''}`}
    >
      {words.map((word, w) => (
        <span key={w} className="flex gap-[0.3em] font-mono whitespace-nowrap">
          {/* A hint letter replaces its blank with a new key, so it pops in. */}
          {[...word].map((ch, i) =>
            LETTER.test(ch) ? (
              <span key={`${i}${ch}`} className="inline-block motion-safe:animate-pop">
                {ch}
              </span>
            ) : (
              <span key={`${i}${ch}`}>{ch}</span>
            ),
          )}
        </span>
      ))}
      <span
        className="font-normal whitespace-nowrap text-white/70"
        style={{ fontSize: `max(${minSize}, 0.6em)` }}
      >
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
          data-chip={p.pid}
          className={`flex min-w-0 items-center gap-[1vmin] rounded-[0.6vmin] px-[0.6vmin] ${p.guessed ? LIT : ''} ${p.connected ? '' : 'opacity-60'}`}
        >
          <span className="w-[1.2em] text-center">{p.isDrawer ? '✏️' : p.guessed ? '✓' : ''}</span>
          <Avatar player={p} size="1.5em" />
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
 * needs to fit the sidebar on one line (an uppercase bold letter is up to about 0.82 em: M, W, O).
 * It wraps between words, never inside one. Portrait (`oneLine`) caps it at 9 vh and fits the whole phrase
 * on one line, to fit under the square; a long phrase (12+ letters) ends up smaller than the timer.
 */
function RevealWord({ word, oneLine = false }: { word: string; oneLine?: boolean }) {
  const letters = oneLine
    ? [...word.trim()].length
    : Math.max(...word.split(/\s+/).map((w) => [...w].length));
  return (
    <p
      className="font-display leading-none font-bold text-[#FF6B35] uppercase"
      style={{
        fontSize: `min(${oneLine ? '9vh' : '12vh'}, calc(100cqw / ${(letters * 0.82).toFixed(2)}))`,
      }}
    >
      {word}
    </p>
  );
}

/** "🎉 Everyone got it!" when they did, then "It was…". In the portrait top bar, on one line. */
function RevealIntro({ turn, t }: { turn: TurnView; t: Translate }) {
  return (
    <>
      {turn.endReason === 'allGuessed' && (
        <p className="font-display text-[max(5vmin,24px)] font-bold text-[#2DC653]">
          {t('everyoneGotIt')} <span aria-hidden="true">🎉</span>
        </p>
      )}
      <p className="text-white/70">{t('itWas')}</p>
    </>
  );
}

/**
 * The reveal: "It was…", the word, who got it, and more. Portrait has "It was…" in its top bar and
 * puts "Got it" on the line with the chips, to fit under the square.
 */
export function RevealPanel({
  view,
  turn,
  t,
  layout = 'landscape',
}: {
  view: ScreenView;
  turn: TurnView;
  t: Translate;
  layout?: ScreenLayout;
}) {
  const portrait = layout === 'portrait';
  const byPid = new Map(view.players.map((p) => [p.pid, p]));
  const drawer = byPid.get(turn.drawerPid);
  const correct = [...turn.correct].sort((a, b) => a.order - b.order);
  return (
    <>
      {!portrait && <RevealIntro turn={turn} t={t} />}
      {turn.word && <RevealWord word={turn.word} oneLine={portrait} />}
      {correct.length === 0 ? (
        <p className="font-display text-[max(5vmin,24px)] font-bold">{t('nobodyGotIt')}</p>
      ) : (
        <div
          className={
            portrait
              ? 'flex flex-wrap items-baseline gap-x-[2vmin] gap-y-[0.8vmin]'
              : 'flex flex-col gap-[0.8vmin]'
          }
        >
          <p className="text-white/70">{t('gotItLabel')}</p>
          {/* Portrait's chips run smaller, so nine of them still fit under the square. */}
          <ul
            className={`flex min-w-0 flex-wrap gap-x-[2vmin] gap-y-[0.8vmin] ${portrait ? 'flex-1 text-[max(0.85em,16px)]' : ''}`}
          >
            {correct.map((c) => {
              const p = byPid.get(c.pid);
              return (
                <li key={c.pid} data-chip={c.pid} className="flex items-center gap-[0.8vmin]">
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

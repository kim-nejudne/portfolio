import { FEED_MAX, LAST_SECONDS_MS } from '../../../../shared/constants.js';
import type { PlayerChipView, ScreenView, TurnView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import type { ScreenInk } from '../../lib/ink.js';
import {
  codeStripCode,
  formatClock,
  hasCaptionRow,
  hintLetters,
  turnCaption,
  wordLengths,
  type ScreenLayout,
} from '../../lib/screen.js';
import { NO_FX, type ScreenFxState } from '../../lib/screenFx.js';
import { useCountdown } from '../../lib/useCountdown.js';
import { Avatar } from '../Avatar.js';
import { NameInColour } from '../phone/NameInColour.js';
import { Blanks } from '../sketch/Blanks.js';
import { CountdownRing } from '../sketch/CountdownRing.js';
import { Tape } from '../sketch/Tape.js';
import { InkCanvas } from './InkCanvas.js';
import { ScreenDesk } from './ScreenDesk.js';
import { GotItLine, TurnFx } from './TurnFx.js';

/**
 * CHOOSING, DRAWING and REVEAL, in the notebook on the desk (Sketchbook look, F64). Landscape (and
 * near-square): a spread whose left page holds the drawing, taped on by two corners, as the
 * largest square that fits (while choosing, who is choosing, large, with the ring); the right page
 * is the sidebar (clock, round and turn, blanks, the drawer line or "Jun got it!", the feed on
 * dashed rules), and the players are index tabs outside the right edge, with ✏️ and "✓ +270".
 * Wrong-guess bubbles pop from the tabs over the right page, never over the drawing. Portrait: one
 * page with a top bar, the full-width square, then the players strip and the two latest guesses
 * (F65 makes it the spread's portrait form).
 */
export function ScreenTurn({
  view,
  receivedAt,
  ink,
  layout,
  fx: allFx = NO_FX,
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
  // The reveal's "Almost:" lists the last guesses, so DRAWING's bubbles end with it (F35).
  const fx = view.phase === 'REVEAL' ? { ...allFx, bubbles: [] } : allFx;
  const code = codeStripCode(view);
  if (layout === 'portrait')
    return (
      <ScreenDesk
        layout="portrait"
        code={code}
        single={
          <PortraitTurn view={view} turn={turn} receivedAt={receivedAt} ink={ink} fx={fx} t={t} />
        }
      />
    );
  return (
    <ScreenDesk
      layout="landscape"
      code={code}
      square
      players={view.players}
      turn
      left={<DrawingPage view={view} turn={turn} receivedAt={receivedAt} ink={ink} t={t} />}
      right={
        <aside className="@container relative flex h-full min-h-0 flex-col gap-[1.8vmin] overflow-hidden text-[max(3.5vh,16px)] leading-tight">
          {view.phase === 'REVEAL' ? (
            <RevealPanel view={view} turn={turn} t={t} />
          ) : (
            <TurnPanel view={view} turn={turn} receivedAt={receivedAt} fx={fx} t={t} />
          )}
        </aside>
      }
      overlay={
        <TurnFx
          fx={fx}
          players={view.players}
          guessFeed={view.settings.guessFeed}
          layout="tabs"
          t={t}
        />
      }
    />
  );
}

/**
 * The landscape left page: the drawing as the largest square that fits, with the first two turns'
 * caption under it; while the drawer is still choosing, who is choosing instead (the canvas stays
 * mounted under it, hidden).
 */
function DrawingPage({
  view,
  turn,
  receivedAt,
  ink,
  t,
}: {
  view: ScreenView;
  turn: TurnView;
  receivedAt: number;
  ink: ScreenInk;
  t: Translate;
}) {
  const captionRow = hasCaptionRow(turn);
  return (
    <div className="flex size-full min-h-0 flex-col items-center gap-[1vmin]">
      {/* A size container, so the square is the smaller of its width and height. */}
      <div className="grid min-h-0 w-full flex-1 place-items-center [container-type:size]">
        <div className="relative aspect-square w-[min(100cqw,100cqh)]">
          <Drawing view={view} turn={turn} receivedAt={receivedAt} ink={ink} t={t} />
        </div>
      </div>
      {captionRow && <Caption text={turnCaption(view, t)} />}
    </div>
  );
}

/**
 * The live drawing on white, taped by its two top corners, and over it while the drawer is still
 * choosing, who is choosing. In the 2 s before a `drawerAway` pause, a small "Mika's phone
 * reconnecting…" note along its top edge.
 */
function Drawing({
  view,
  turn,
  receivedAt,
  ink,
  t,
}: {
  view: ScreenView;
  turn: TurnView;
  receivedAt: number;
  ink: ScreenInk;
  t: Translate;
}) {
  const choosing = view.phase === 'CHOOSING';
  return (
    <>
      <div
        data-drawing
        className={`relative size-full border-[length:max(2px,0.28vmin)] border-ink bg-canvas ${choosing ? 'invisible' : ''}`}
      >
        <Tape place="tl" />
        <Tape place="tr" />
        <InkCanvas ink={ink} label={t('liveDrawing')} className="" />
      </div>
      {choosing && <Choosing view={view} turn={turn} receivedAt={receivedAt} t={t} />}
      {/* Always mounted, so the note is announced when it appears. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none absolute inset-x-0 top-[2vmin] z-[4] flex justify-center px-[2vmin]"
      >
        {turn.drawerReconnecting && (
          <p className="max-w-[90%] sketch-border bg-sticky px-[3vmin] py-[1vmin] text-center text-[max(4.5vmin,22px)] leading-tight text-ink shadow-[0.42vmin_0.56vmin_0_var(--color-ink)]">
            {t('drawerReconnecting', { name: turn.drawerName })}
          </p>
        )}
      </div>
    </>
  );
}

/**
 * CHOOSING on the drawing's page: the drawer's avatar large, "Mika is choosing a word…" with the
 * name in their colour, and the ring counting down the 12 s choice.
 */
function Choosing({
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
  const drawer = drawerChip(view, turn);
  return (
    <div
      data-choosing
      className="absolute inset-0 grid content-center justify-items-center gap-[2.5vmin] p-[2vmin] text-center"
    >
      {'avatar' in drawer && <Avatar player={drawer} size="max(18vmin, 64px)" />}
      <p className="text-[max(6.1vmin,24px)] leading-tight break-words">
        <NameInColour say={(name) => t('isChoosing', { name })} player={drawer} />
      </p>
      {turn.timer && (
        <span role="timer" aria-label={t('seconds', { n: Math.ceil(left / 1000) })}>
          <CountdownRing
            remainingMs={left}
            totalMs={turn.timer.totalMs}
            choosing
            size="max(16.7vmin, 64px)"
          />
        </span>
      )}
    </div>
  );
}

/** The drawer's chip, or their name alone if the chip is gone. */
function drawerChip(
  view: ScreenView,
  turn: TurnView,
): PlayerChipView | { name: string; color: string } {
  return (
    view.players.find((p) => p.pid === turn.drawerPid) ?? {
      name: turn.drawerName,
      color: 'inherit',
    }
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
          <Drawing view={view} turn={turn} receivedAt={receivedAt} ink={ink} t={t} />
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
  const urgent = view.phase === 'DRAWING' && left <= LAST_SECONDS_MS;
  return (
    <>
      <p
        className={`shrink-0 font-num text-[max(8vmin,36px)] leading-none font-black tabular-nums ${urgent ? 'text-red' : ''}`}
        role="timer"
      >
        {formatClock(left)}
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
          turn.mask && (
            <Blanks
              mask={turn.mask}
              label={blanksLabel(turn.mask, t)}
              size="max(5vmin, 22px)"
              countMin={BLANKS_COUNT_MIN}
              pop
            />
          )
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
          <span className="truncate" style={{ color: p.color }}>
            {p.name}
          </span>
          {p.guessed && p.turnPoints > 0 && <span className="tabular-nums">+{p.turnPoints}</span>}
        </li>
      ))}
    </ul>
  );
}

/** A correct guesser's portrait chip stays lit for the rest of the turn (every chip has its padding, so lighting one moves nothing). */
const LIT = 'bg-success/15';

/**
 * The latest wrong guesses, newest last, each on a dashed rule, the name in the guesser's colour
 * ("•••" for a masked one); the newest pops in. `fill` (the right page): up to the last 8 at the
 * page's foot; when the height runs out the oldest are cut off at the top, never below two lines.
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
  const shown = view.feed.slice(-latest);
  return (
    <ul
      data-feed
      className={`flex flex-col ${
        fill
          ? 'mt-auto min-h-[calc(2lh+1.2vmin)] shrink-[100] justify-end overflow-hidden text-[max(3.6vmin,16px)]'
          : 'shrink-0'
      }`}
    >
      {shown.map((g, i) => {
        const last = i === shown.length - 1;
        return (
          <li
            // The newest gets a key of its own, so it pops each time one comes in.
            key={last ? `new:${view.feed.length}:${g.pid}:${g.text ?? ''}` : i}
            className={`shrink-0 truncate border-b-[1.5px] border-dashed border-dot py-[0.3vmin] ${last ? 'origin-left motion-safe:animate-pop' : ''}`}
          >
            <span style={{ color: names.get(g.pid)?.color }}>{names.get(g.pid)?.name}</span>:{' '}
            {g.text ?? '•••'}
          </li>
        );
      })}
    </ul>
  );
}

/** Two lines of names-sized text (3.5 vh) with their line height. */
const CAPTION_HEIGHT = 'max(9vh, 44px)';
/** Portrait: two lines at the portrait text size (3.5 vmin). */
const PORTRAIT_CAPTION_HEIGHT = 'max(9vmin, 42px)';

/**
 * The first two turns' caption, under the drawing and never over it (Screen, Drawing). As wide as
 * its page (`w-0 min-w-full` keeps the text from widening it) and at most two lines. Empty outside
 * DRAWING, keeping its row, so the drawing keeps its size.
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
      {/* About 32 characters a line: the text shrinks when the page is narrow, so the first
          turn's caption stays on two lines. */}
      <p
        className={`line-clamp-2 text-center leading-tight text-ink ${
          portrait ? 'text-[min(max(3.5vmin,16px),5.5cqw)]' : 'text-[min(max(3.5vh,16px),5.5cqw)]'
        }`}
      >
        {text}
      </p>
    </div>
  );
}

/**
 * The right page during CHOOSING and DRAWING: the Nunito clock (red in the last 10 s) with the
 * round and turn beside it in `soft`, the blanks with their counts, "✏️ Mika is drawing" (or,
 * for 2 s, "Jun got it!" on the highlighter in its place), and the feed at the foot. While the
 * drawer is choosing, "Next up: ✏️ Mika" (the ring is on the left page).
 */
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
  const drawing = view.phase === 'DRAWING';
  const urgent = drawing && left <= LAST_SECONDS_MS;
  const drawer = drawerChip(view, turn);
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-[2vmin] gap-y-[0.6vmin]">
        {drawing && (
          <p
            className={`font-num text-[max(8.9vmin,40px)] leading-none font-black tabular-nums ${urgent ? 'text-red' : ''}`}
            role="timer"
          >
            {formatClock(left)}
          </p>
        )}
        <p className="text-[max(2.6vmin,14px)] text-soft">
          {t('roundTurn', { cycle: turn.cycle, cycles: view.settings.cycles, turn: turn.number })}
        </p>
      </div>
      {turn.mask && (
        <Blanks
          mask={turn.mask}
          label={blanksLabel(turn.mask, t)}
          size="max(5.6vmin, 24px)"
          countMin={BLANKS_COUNT_MIN}
          className="shrink-0"
          pop
        />
      )}
      {drawing ? (
        // One live region for the whole turn, so each "got it" is announced.
        <div role="status" aria-live="polite" className="shrink-0 text-[max(3.9vmin,18px)]">
          {fx.gotIt.length > 0 ? (
            <GotItLine
              gotIt={fx.gotIt}
              players={view.players}
              className="text-[max(5.6vmin,24px)]"
              t={t}
            />
          ) : (
            // Two lines at most, so a long name on a narrow (4:3) page is still read whole.
            <p className="line-clamp-2 break-words">
              <NameInColour say={(name) => t('isDrawing', { name })} player={drawer} />
            </p>
          )}
        </div>
      ) : (
        <p className="line-clamp-2 shrink-0 break-words text-[max(3.9vmin,18px)]">
          <NameInColour say={(name) => t('nextUp', { name })} player={drawer} />
        </p>
      )}
      <Feed view={view} latest={FEED_MAX} fill />
    </>
  );
}

/** The letter counts' floor: legible from the couch even when a long phrase shrinks the blanks. */
const BLANKS_COUNT_MIN = 'max(2.6vmin, 14px)';

/** The blanks' label for screen readers: the letters per word, then any hint letters. */
export function blanksLabel(mask: readonly string[], t: Translate): string {
  const lengths = wordLengths(mask);
  const hints = hintLetters(mask);
  const label = t('wordLettersLabel', { lengths: lengths.join(', ') });
  return hints.length ? t('hintsLabel', { label, letters: hints.join(', ') }) : label;
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
      key={word}
      className="origin-left font-num leading-none font-black text-ink uppercase motion-safe:animate-reveal"
      style={{
        fontSize: `min(${oneLine ? '9vh' : '12vh'}, calc(100cqw / ${(letters * 0.82).toFixed(2)}))`,
      }}
    >
      {word}
    </p>
  );
}

/**
 * The headline, "Everyone got it! 🎉" or "Nobody got it! 😱", when there is one, then "It was…".
 * In the portrait top bar, on one line.
 */
function RevealIntro({ turn, t }: { turn: TurnView; t: Translate }) {
  return (
    <>
      {turn.correct.length === 0 ? (
        <p className="text-[max(5vmin,24px)] leading-tight">
          {t('nobodyGotIt')} <span aria-hidden="true">😱</span>
        </p>
      ) : (
        turn.endReason === 'allGuessed' && (
          <p className="text-[max(5vmin,24px)] leading-tight text-success">
            {t('everyoneGotIt')} <span aria-hidden="true">🎉</span>
          </p>
        )
      )}
      <p className="text-soft">{t('itWas')}</p>
    </>
  );
}

/**
 * The reveal: the headline and "It was…", the word, who got it (corrected order, from the server),
 * "Almost:" and the drawer's points. Nobody got it: no points rows at all. No "+0" anywhere. Portrait
 * has the headline and "It was…" in its top bar and puts "Got it" on the line with the chips, to fit
 * under the square.
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
      {correct.length > 0 && (
        <div
          className={
            portrait
              ? 'flex flex-wrap items-baseline gap-x-[2vmin] gap-y-[0.8vmin]'
              : 'flex flex-col gap-[0.8vmin]'
          }
        >
          <p className="text-soft">{t('gotItLabel')}</p>
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
                  {c.points > 0 && (
                    <span className="font-num font-black tabular-nums">+{c.points}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {view.almost.length > 0 && (
        <p className="text-soft">
          {t('almost')} {view.almost.map((g) => g.text ?? '•••').join(' · ')}
        </p>
      )}
      {correct.length > 0 && drawer && drawer.turnPoints > 0 && (
        <p>{t('drawerPoints', { points: drawer.turnPoints, name: drawer.name })}</p>
      )}
    </>
  );
}

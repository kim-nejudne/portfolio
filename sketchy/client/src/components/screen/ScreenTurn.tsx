import { Fragment, useRef, type CSSProperties, type ReactNode } from 'react';
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
import { useNunitoEm, useShrinkToFit } from '../../lib/fit.js';
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
 * CHOOSING, DRAWING and REVEAL, in the notebook on the desk (Sketchbook look, F64, F65). Landscape
 * (and near-square): a spread whose left page holds the drawing, taped on by two corners, as the
 * largest square that fits (while choosing, who is choosing, large, with the ring); the right page
 * is the sidebar (clock, round and turn, blanks, the drawer line or "Jun got it!", the feed on
 * dashed rules; at the reveal the word and who got it), and the players are index tabs outside the
 * right edge, with ✏️ and "✓ +270". Portrait: the right page becomes a top bar over the drawing's
 * page (clock and blanks, the drawer line, the latest guess; at the reveal "It was…" and the word),
 * the rings run across, and the tabs stand along the bottom. Wrong-guess bubbles pop from the
 * tabs, never over the drawing.
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
  const overlay = (
    <>
      <TurnFx
        fx={fx}
        players={view.players}
        guessFeed={view.settings.guessFeed}
        layout="tabs"
        t={t}
      />
      {/* Mounted all turn long, so screen readers hear the word when it comes. */}
      <p role="status" aria-live="polite" className="sr-only">
        {view.phase === 'REVEAL' && turn.word ? `${t('itWas')} ${turn.word}` : ''}
      </p>
    </>
  );
  if (layout === 'portrait')
    return (
      <ScreenDesk
        layout="portrait"
        code={code}
        players={view.players}
        turn
        // Portrait stacks the spread: the first page is the top bar, the second the drawing's.
        left={<TopBar view={view} turn={turn} receivedAt={receivedAt} fx={fx} t={t} />}
        right={
          <PortraitDrawingPage view={view} turn={turn} receivedAt={receivedAt} ink={ink} t={t} />
        }
        overlay={overlay}
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
      overlay={overlay}
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
 * The portrait top bar's height, the same through CHOOSING, DRAWING and REVEAL, so the drawing
 * under it keeps its size: room for the reveal's "It was…" line and the word at 12 vh, or for the
 * clock, the drawer line and the latest guess, whichever is taller.
 */
// SPEC-QUESTION: the spec doesn't size the portrait top bar; one height for the whole turn keeps
// the drawing where it is at the reveal (DECISIONS 88).
const TOP_BAR_HEIGHT =
  'max(calc(max(4.4vmin, 20px) + 12vh + 1vmin), calc(max(8vmin, 36px) + max(4.4vmin, 20px) + max(5vmin, 23px) + 2vmin))';

/**
 * The lane between the portrait square and the tabs: tall enough for a wrong-guess bubble (≥ 5 vh
 * text), the first two turns' caption and three lines of the reveal's rows. It keeps its height
 * through the turn.
 */
export const PORTRAIT_LANE = 'max(12vmin, 6.6vh, 64px)';

/**
 * The portrait top bar (the right page's portrait form): the clock and blanks on one line, then
 * "✏️ Mika is drawing" (or, for 2 s, "Jun got it!" in its place), then the latest guess. Round and
 * turn numbers are dropped (the spec's portrait priority). While choosing, "Next up: ✏️ Mika" (the
 * ring is on the drawing's page). At the reveal, the headline and "It was…", then the word.
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
  const reveal = view.phase === 'REVEAL';
  return (
    <header
      data-top-bar
      className="@container flex flex-col gap-[1vmin] overflow-hidden text-[max(3.5vmin,16px)] leading-tight"
      style={{ height: TOP_BAR_HEIGHT }}
    >
      {reveal ? (
        <PortraitReveal turn={turn} t={t} />
      ) : (
        <TopBarTurn view={view} turn={turn} receivedAt={receivedAt} fx={fx} t={t} />
      )}
    </header>
  );
}

function TopBarTurn({
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
  if (!drawing)
    return (
      <p className="line-clamp-2 shrink-0 break-words text-[max(4.4vmin,20px)]">
        <NameInColour say={(name) => t('nextUp', { name })} player={drawer} />
      </p>
    );
  return (
    <>
      <div className="flex shrink-0 items-center gap-[3vmin]">
        <p
          className={`shrink-0 font-num text-[max(8vmin,36px)] leading-none font-black tabular-nums ${urgent ? 'text-red' : ''}`}
          role="timer"
        >
          {formatClock(left)}
        </p>
        <div className="@container min-w-0 flex-1">
          {turn.mask && (
            <Blanks
              mask={turn.mask}
              label={blanksLabel(turn.mask, t)}
              size="max(5vmin, 22px)"
              countMin={BLANKS_COUNT_MIN}
              pop
            />
          )}
        </div>
      </div>
      {/* One live region for the whole turn, so each "got it" is announced. */}
      <div
        role="status"
        aria-live="polite"
        className="flex h-[max(4.4vmin,20px)] shrink-0 items-center"
      >
        {fx.gotIt.length > 0 ? (
          <GotItLine gotIt={fx.gotIt} players={view.players} t={t} />
        ) : (
          <p className="truncate">
            <NameInColour say={(name) => t('isDrawing', { name })} player={drawer} />
          </p>
        )}
      </div>
      <Feed view={view} latest={1} />
    </>
  );
}

/**
 * The portrait drawing's page: the drawing as the largest square that fits, then the lane above
 * the tabs, where the bubbles pop up from the tabs, the first two turns' caption sits, and at the
 * reveal who got it, "Almost:", the drawer's points and who draws next.
 */
function PortraitDrawingPage({
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
  const reveal = view.phase === 'REVEAL';
  return (
    <div className="flex size-full min-h-0 flex-col items-center gap-[1vmin]">
      <div className="grid min-h-0 w-full flex-1 place-items-center [container-type:size]">
        <div className="relative aspect-square w-[min(100cqw,100cqh)]">
          <Drawing view={view} turn={turn} receivedAt={receivedAt} ink={ink} t={t} />
        </div>
      </div>
      <div
        data-bubble-lane
        className="@container relative w-0 min-w-full shrink-0 overflow-hidden"
        style={{ height: PORTRAIT_LANE }}
      >
        {reveal ? (
          <RevealDetails view={view} turn={turn} t={t} compact />
        ) : (
          hasCaptionRow(turn) && <Caption text={turnCaption(view, t)} layout="portrait" />
        )}
      </div>
    </div>
  );
}

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
 * The word on the highlighter in Nunito 900, the largest text on screen: 12 vh, scaled down only as
 * far as its longest word needs to fit the page on one line (an uppercase black letter is up to
 * about 0.82 em: M, W, O; with room for the pop's 1.06 overshoot and the swash's ends). Landscape
 * wraps between words, never inside one; portrait (`oneLine`) fits the whole phrase on one line
 * in the top bar. It pops in (the mockup's sk-pop), each time a new word comes.
 */
function RevealWord({
  word,
  size,
  oneLine = false,
}: {
  word: string;
  size: string;
  oneLine?: boolean;
}) {
  return (
    <div className="shrink-0 px-[0.2em]" style={{ fontSize: size }}>
      <p
        key={word}
        className={`highlight inline-block max-w-full origin-left font-num leading-none font-black text-ink uppercase motion-safe:animate-reveal ${oneLine ? '' : 'whitespace-normal'}`}
        data-reveal-word
      >
        {word}
      </p>
    </div>
  );
}

/**
 * The portrait reveal in the top bar: the headline and "It was…" on one line at the bar's size
 * (never more than 0.75 of the word's), then the word, the whole phrase on one line.
 */
function PortraitReveal({ turn, t }: { turn: TurnView; t: Translate }) {
  const size = useWordSize(turn.word ?? '', true);
  return (
    <div className="contents" style={{ '--word': turn.word ? size : '100vh' } as CSSProperties}>
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-[2vmin] text-[min(max(3.5vmin,16px),calc(var(--word)*0.75))]">
        <RevealIntro turn={turn} t={t} inline />
      </div>
      {turn.word && <RevealWord word={turn.word} size="var(--word)" oneLine />}
    </div>
  );
}

/** The letters the reveal word must fit on one line: the whole phrase, or its longest word. */
function wordLetters(word: string, oneLine: boolean): number {
  return oneLine
    ? [...word.trim()].length
    : Math.max(...word.split(/\s+/).map((w) => [...w].length));
}

/**
 * The reveal word's size: 12 vh unless the page is too narrow for it. `em` is its measured width
 * (`useNunitoEm`); until then, about 0.82 em a letter (M, W, O), its longest run of `letters`.
 */
export function wordSize(letters: number, em: number | null = null): string {
  return `min(12vh, calc(100cqw / ${((em ?? letters * 0.82) * 1.06 + 0.4).toFixed(2)}))`;
}

/** The reveal word's size on this page, from its measured width once the font is in. */
function useWordSize(word: string, oneLine: boolean): string {
  return wordSize(wordLetters(word, oneLine), useNunitoEm(word, oneLine));
}

/**
 * The headline, "Everyone got it! 🎉" or "Nobody got it! 😱", when there is one, then "It was…".
 * In the portrait top bar, on one line.
 */
function RevealIntro({
  turn,
  t,
  inline = false,
}: {
  turn: TurnView;
  t: Translate;
  /** Portrait: the headline at the line's own size, beside "It was…". */
  inline?: boolean;
}) {
  // Never more than 0.75 of the word (`--word`): Patrick Hand's letters stand taller than Nunito
  // capitals at the same size, and the word must read as the largest text.
  const headline = inline ? '' : 'text-[min(max(5vmin,24px),calc(var(--word,100vh)*0.75))]';
  return (
    <>
      {turn.correct.length === 0 ? (
        <p className={`${headline} leading-tight`}>
          {t('nobodyGotIt')} <span aria-hidden="true">😱</span>
        </p>
      ) : (
        turn.endReason === 'allGuessed' && (
          <p className={`${headline} leading-tight text-success`}>
            {t('everyoneGotIt')} <span aria-hidden="true">🎉</span>
          </p>
        )
      )}
      <p className="text-soft">{t('itWas')}</p>
    </>
  );
}

/**
 * The landscape reveal on the right page: the headline and "It was…", the word on the highlighter,
 * then who got it and the rest (`RevealDetails`). The word stays the largest text: on a narrow page
 * (a 4:3 Screen) a long word shrinks to fit, and the rest of the page shrinks with it (`--word`).
 */
export function RevealPanel({ view, turn, t }: { view: ScreenView; turn: TurnView; t: Translate }) {
  const size = useWordSize(turn.word ?? '', false);
  const box = useRef<HTMLDivElement>(null);
  // Measured again for a new word or a change in who got it.
  useShrinkToFit(box, `${turn.word}:${detailsKey(view, turn)}`);
  return (
    // The page's own box (the aside's size), so a full room's rows shrink rather than run off.
    <div
      ref={box}
      className="flex h-full min-h-0 flex-col gap-[1.8vmin] overflow-hidden"
      style={
        {
          '--word': turn.word ? size : '100vh',
          fontSize: 'calc(min(max(3.5vh, 16px), var(--word) * 0.75) * var(--fit, 1))',
        } as CSSProperties
      }
    >
      <RevealIntro turn={turn} t={t} />
      {turn.word && <RevealWord word={turn.word} size="var(--word)" />}
      <RevealDetails view={view} turn={turn} t={t} />
    </div>
  );
}

/**
 * Who got it (corrected order, from the server) with their points, "Almost:" with each guess
 * struck in red pen, the drawer's points (only above 0) and "Next: Jun draws". Nobody got it: no
 * points rows at all. No "+0" anywhere. Landscape: one got-it row each on a dashed rule. `compact`
 * (the portrait lane): everything runs on as wrapped lines at a smaller size, so a full room fits.
 */
function RevealDetails({
  view,
  turn,
  t,
  compact = false,
}: {
  view: ScreenView;
  turn: TurnView;
  t: Translate;
  compact?: boolean;
}) {
  const byPid = new Map(view.players.map((p) => [p.pid, p]));
  const drawer = byPid.get(turn.drawerPid);
  const correct = [...turn.correct].sort((a, b) => a.order - b.order);
  const drawerLine = correct.length > 0 && drawer && drawer.turnPoints > 0 && (
    <p data-drawer-points>
      <NameInColour
        say={(name) => t('drawerPoints', { points: drawer.turnPoints, name })}
        player={drawer}
      />
    </p>
  );
  const next = view.nextDrawer && (
    <p data-next>
      <NameInColour say={(name) => t('nextDraws', { name })} player={view.nextDrawer} />
    </p>
  );
  const almost = view.almost.length > 0 && (
    <p>
      <span className="text-soft">{t('almost')}</span>{' '}
      {view.almost.map((g, i) => (
        <Fragment key={i}>
          {i > 0 && ' · '}
          {/* The strike is decoration, so only the line tilts; the guess stays level. */}
          <s className="relative text-red no-underline after:absolute after:inset-x-[-0.1em] after:top-[55%] after:h-[max(2px,0.3vmin)] after:-rotate-[4deg] after:bg-red">
            {g.text ?? '•••'}
          </s>
        </Fragment>
      ))}
    </p>
  );
  const rows = correct.map((c) => {
    const p = byPid.get(c.pid);
    return (
      <li
        key={c.pid}
        data-chip={c.pid}
        className={
          compact
            ? 'flex items-center gap-[0.6vmin]'
            : 'flex items-center gap-[1vmin] border-b-[1.5px] border-dashed border-dot py-[0.5vmin]'
        }
      >
        {p && <Avatar player={p} size="1.1em" />}
        <span className={compact ? '' : 'min-w-0 flex-1 truncate'} style={{ color: p?.color }}>
          {p?.name}
        </span>
        {c.points > 0 && <span className="font-num font-black tabular-nums">+{c.points}</span>}
      </li>
    );
  });
  if (compact)
    return (
      <CompactDetails fitKey={detailsKey(view, turn)}>
        {correct.length > 0 && (
          <>
            <p className="text-soft">{t('gotItLabel')}</p>
            <ul className="contents">{rows}</ul>
          </>
        )}
        {almost}
        {drawerLine}
        {next}
      </CompactDetails>
    );
  return (
    <>
      {correct.length > 0 && (
        <div className="flex shrink-0 flex-col gap-[0.4vmin]">
          <p className="text-soft">{t('gotItLabel')}</p>
          <ul className="flex flex-col">{rows}</ul>
        </div>
      )}
      {almost}
      {drawerLine}
      {next}
    </>
  );
}

/** Everything the reveal rows show, so they are fitted again whenever any of it changes. */
function detailsKey(view: ScreenView, turn: TurnView): string {
  return JSON.stringify([
    turn.correct,
    view.almost,
    view.nextDrawer?.pid,
    view.players.find((p) => p.pid === turn.drawerPid)?.turnPoints,
  ]);
}

/**
 * The portrait lane's reveal rows, run on as wrapped lines, scaled down when a full room's would
 * not fit its three lines.
 */
function CompactDetails({ fitKey, children }: { fitKey: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useShrinkToFit(box, fitKey);
  return (
    <div
      ref={box}
      data-reveal-details
      className="flex h-full flex-wrap content-start items-baseline gap-x-[2.2vmin] gap-y-[0.4vmin] overflow-hidden leading-tight"
      style={{ fontSize: 'calc(max(3vmin, 14px) * var(--fit, 1))' }}
    >
      {children}
    </div>
  );
}

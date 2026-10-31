import type { CSSProperties, ReactNode } from 'react';
import type { PlayerChipView } from '../../../../shared/types.js';
import type { ScreenLayout } from '../../lib/screen.js';
import { Tape } from '../sketch/Tape.js';
import { PlayerTabs, portraitTabsHeight } from './PlayerChip.js';

/** The desk showing round the book. */
const EDGE = '3vmin';
/** The room under the book for the code strip. */
const CODE_ROOM = 'max(8vmin, 2.5rem)';
/**
 * How wide the landscape tabs are, and so the room right of the book (they overlap it by EDGE).
 * Wider than the mockup's 150 px (21 vmin), so a name keeps about 11 letters at 3.6 vmin.
 */
const TAB_COLUMN = '28vmin';
/** The gap between the portrait tabs and the code strip under them. */
const TAB_LIFT = '0.8vmin';
/** How far the portrait tabs tuck under the book's bottom edge. */
const TAB_TUCK = '2vmin';

/** The dot grid on a Screen page, in vmin like everything on the Screen (24 px on a 720 px frame). */
const PAGE_DOTS: CSSProperties = {
  backgroundSize: '3.3vmin 3.3vmin',
  backgroundPosition: '1.65vmin 1.65vmin',
};

/**
 * The Screen's frame (Sketchbook look, F62): a spiral notebook open on the `desk`. Landscape is a
 * spread, the `left` page, a gutter with vertical rings and the `right` page; portrait stacks them
 * with a row of rings between. `single` is one page and no rings. The players stand as index tabs
 * outside the book's right edge (landscape) or along its bottom (portrait), and the room code sits
 * on a strip of tape under it (`code: null` hides the strip, as during FINAL's gallery). Every size
 * is in vmin, so a TV, a laptop and a tablet see the same book.
 */
export function ScreenDesk({
  layout,
  left,
  right,
  single,
  singleClassName = '',
  plain = false,
  code,
  players,
  onSelectPlayer,
}: {
  layout: ScreenLayout;
  left?: ReactNode;
  right?: ReactNode;
  /** One page instead of the spread. */
  single?: ReactNode;
  singleClassName?: string;
  /** The single page without its dot grid (a page painted dark until F64–F66). */
  plain?: boolean;
  code: string | null;
  /** Index tabs, in turn order; none while omitted. */
  players?: PlayerChipView[];
  onSelectPlayer?: (pid: string) => void;
}) {
  const portrait = layout === 'portrait';
  const spread = single === undefined;
  const tabs = players && players.length > 0 ? players : null;
  const below = code === null ? EDGE : CODE_ROOM;
  const desk: CSSProperties = portrait
    ? {
        padding: `${EDGE} ${EDGE} ${tabs ? `calc(${below} + ${TAB_LIFT} + ${portraitTabsHeight(tabs.length)} - ${TAB_TUCK})` : below}`,
      }
    : { padding: `${EDGE} ${tabs ? TAB_COLUMN : EDGE} ${below} ${EDGE}` };
  // A page scrolls rather than clips if a small portrait phone, used as the Screen, runs out of
  // height; at 16:9, 4:3 and 3:4 nothing scrolls.
  const page = 'paper-dots relative min-h-0 min-w-0 overflow-y-auto overscroll-contain p-[3vmin]';
  return (
    <div data-desk={layout} className="relative size-full" style={desk}>
      <div
        data-book
        className={`relative z-[1] size-full overflow-hidden rounded-[0.6vmin] border-[length:max(2px,0.28vmin)] border-ink bg-paper text-ink shadow-[0.8vmin_1vmin_0_var(--color-ink)] ${
          spread
            ? `grid ${portrait ? 'grid-rows-[auto_4.2vmin_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1.1fr)_4.7vmin_minmax(0,1fr)]'}`
            : ''
        }`}
      >
        {spread ? (
          <>
            <section className={page} style={PAGE_DOTS}>
              {left}
            </section>
            <Gutter layout={layout} />
            {/* Clear of the tabs that stand over the book's right edge. */}
            <section
              className={`${page} ${tabs && !portrait ? 'pr-[calc(3vmin+3vmin)]' : ''}`}
              style={PAGE_DOTS}
            >
              {right}
            </section>
          </>
        ) : (
          <section
            className={`size-full min-h-0 min-w-0 ${plain ? '' : 'paper-dots'} ${singleClassName}`}
            style={plain ? undefined : PAGE_DOTS}
          >
            {single}
          </section>
        )}
      </div>
      {tabs && (
        <PlayerTabs
          players={tabs}
          layout={layout}
          {...(onSelectPlayer ? { onSelect: onSelectPlayer } : {})}
          className="absolute z-[2]"
          style={
            portrait
              ? {
                  left: EDGE,
                  right: EDGE,
                  bottom: `calc(${below} + ${TAB_LIFT})`,
                  height: portraitTabsHeight(tabs.length),
                }
              : { right: EDGE, width: TAB_COLUMN, top: '8vmin', bottom: `calc(${below} + 1vmin)` }
          }
        />
      )}
      {code !== null && <CodeStrip code={code} layout={layout} />}
    </div>
  );
}

/**
 * The spine between the pages: a `dot` rule either side and the spiral wire, vertical in landscape
 * and across in portrait. Decoration only.
 */
function Gutter({ layout }: { layout: ScreenLayout }) {
  const portrait = layout === 'portrait';
  return (
    <div
      aria-hidden
      data-rings={portrait ? 'row' : 'column'}
      className={`pointer-events-none relative z-[2] flex justify-around border-dot ${
        portrait
          ? 'items-center border-y-[1.5px] px-[2.5vmin]'
          : 'flex-col items-center border-x-[1.5px] py-[2vmin]'
      }`}
    >
      {Array.from({ length: portrait ? 14 : 11 }, (_, i) => (
        <i
          key={i}
          className={`shrink-0 rounded-[1.1vmin] border-[length:max(2px,0.42vmin)] border-ring ${
            portrait ? 'h-[6.1vmin] w-[1.7vmin]' : 'h-[1.7vmin] w-[6.4vmin]'
          }`}
        />
      ))}
    </div>
  );
}

/**
 * The room code on a strip of masking tape, centred under the book: the address and the code in
 * Nunito. Portrait leads with the code and lets the address run out ("KPRW · sketchy.kimn…"), so
 * the code is never the part cut off.
 */
function CodeStrip({ code, layout }: { code: string; layout: ScreenLayout }) {
  const host = window.location.host;
  const strong = <strong className="font-black tracking-[0.12em]">{code}</strong>;
  return (
    <footer
      data-code-strip
      className="absolute bottom-[max(1.6vmin,6px)] left-1/2 z-[2] flex h-[max(5vmin,28px)] max-w-[94%] -translate-x-1/2 items-center px-[3.6vmin]"
    >
      <Tape place="wide" />
      <span className="relative z-[4] truncate font-num text-[max(2.8vmin,14px)] font-extrabold text-ink">
        {layout === 'portrait' ? (
          <>
            {strong} · {host}
          </>
        ) : (
          <>
            {host} · {strong}
          </>
        )}
      </span>
    </footer>
  );
}

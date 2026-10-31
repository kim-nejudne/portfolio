import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { PlayerChipView, RoomSettings } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import type { GotIt, ScreenFxState } from '../../lib/screenFx.js';

/**
 * "Jun got it!" on a highlighter swash, the name in Jun's colour (several names when they land
 * together), for `ANNOUNCE_MS`. It takes the place of a line on the right page or the portrait top
 * bar, never the drawing's. It is large text (≥ 24 px), so every crayon keeps 3:1 on the swash.
 */
export function GotItLine({
  gotIt,
  players,
  className = '',
  t,
}: {
  gotIt: GotIt[];
  players: PlayerChipView[];
  className?: string;
  t: Translate;
}) {
  const byPid = new Map(players.map((p) => [p.pid, p]));
  const names = gotIt.flatMap((g) => byPid.get(g.pid) ?? []);
  const [before, after] = t('gotIt', { name: NAME_SLOT }).split(NAME_SLOT);
  return (
    // Keyed by the newest, so each new one pops again. The live region is the caller's, which
    // stays mounted, so screen readers announce the change.
    <p
      key={gotIt.at(-1)?.id}
      className={`highlight inline-block max-w-full origin-left truncate px-[0.22em] font-hand leading-tight font-normal motion-safe:animate-pop ${className}`}
    >
      {before}
      {names.map((p, i) => (
        <Fragment key={p.pid}>
          {i > 0 && ', '}
          <span style={{ color: p.color }}>{p.name}</span>
        </Fragment>
      ))}
      {after}
    </p>
  );
}

const NAME_SLOT = '\u0000';

/** A box in the layer's own px. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Boxes {
  /** Each player's chip (portrait strip) or index tab (landscape). */
  chips: Map<string, ChipBox>;
  /** The right page, where a tab's bubbles go (landscape). */
  page: Box | null;
  w: number;
  h: number;
  bubbleHeight: number;
  /** A reaction's size in px. */
  emoji: number;
  rise: number;
  /** The room between a bubble and its tab, and the page's edge. */
  gap: number;
}

interface ChipBox extends Box {
  /** Where the chip's contents end (a strip chip is wider than its name). */
  end: number;
}

/**
 * Where a wrong-guess bubble from a landscape index tab goes: just left of the tab, on its row, over
 * the right page and never past the page's left edge (the spine and the drawing are beyond it).
 * The bubble hugs the tab and a long guess is cut short at the page edge. `null` when the page
 * has no room for one.
 */
export function placeTabBubble(
  tab: Box,
  page: Box,
  height: number,
  gap: number,
  layerHeight: number,
): { left: number; width: number; top: number } | null {
  const left = page.left + gap;
  const width = tab.left - gap - left;
  if (width < height) return null;
  const centred = (tab.top + tab.bottom) / 2 - height / 2;
  const top = Math.min(Math.max(centred, 0), Math.max(layerHeight - height, 0));
  return { left, width, top };
}

/**
 * Wrong-guess speech bubbles and floating reactions (the mockup's sk-bubble and sk-float), drawn
 * from each player's chip in the parent. `tabs` (landscape): the layer lies over the whole desk;
 * a bubble pops out left of the guesser's index tab (`data-tab`) over the right page, never over
 * the drawing, and a reaction rises from the tab's top corner. `portrait`: the chips (`data-chip`)
 * sit side by side in the room under the drawing, which clips the layer; the bubbles stack under
 * the strip, each starting under its chip, or sit on the chip's row when there is no room. A
 * bubble is paper with a border in the guesser's colour; under reduced motion everything fades.
 */
export function TurnFx({
  fx,
  players,
  guessFeed,
  layout,
  t,
}: {
  fx: ScreenFxState;
  players: PlayerChipView[];
  guessFeed: RoomSettings['guessFeed'];
  layout: 'tabs' | 'portrait';
  t: Translate;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<Boxes | null>(null);
  const active = fx.bubbles.length > 0 || fx.floats.length > 0;
  const tabs = layout === 'tabs';

  // Measured when a bubble or reaction comes, and again whenever the layer changes size while one
  // is up (a window resized, fullscreen entered, a tablet turned), so none is drawn from an old
  // layout, over a tab or off the edge.
  useLayoutEffect(() => {
    const el = layer.current;
    if (!el || !active) return;
    const measure = () => {
      const origin = el.getBoundingClientRect();
      const local = (r: DOMRect): Box => ({
        left: r.left - origin.left,
        top: r.top - origin.top,
        right: r.right - origin.left,
        bottom: r.bottom - origin.top,
      });
      const chips = new Map<string, ChipBox>();
      const parent = el.parentElement;
      for (const chip of parent?.querySelectorAll<HTMLElement>(
        tabs ? '[data-tab]' : '[data-chip]',
      ) ?? []) {
        const r = chip.getBoundingClientRect();
        const end = Math.max(
          r.left,
          ...[...chip.children].map((c) => c.getBoundingClientRect().right),
        );
        chips.set((tabs ? chip.dataset.tab : chip.dataset.chip)!, {
          ...local(r),
          end: end - origin.left,
        });
      }
      const page = tabs ? parent?.querySelector<HTMLElement>('[data-page="right"]') : null;
      const vh = window.innerHeight / 100;
      const vmin = Math.min(window.innerWidth, window.innerHeight) / 100;
      setBoxes({
        chips,
        page: page ? local(page.getBoundingClientRect()) : null,
        w: origin.width,
        h: origin.height,
        // Bubble text is at least 5 vh; with its padding and border a bubble is about 1.3 of that.
        bubbleHeight: Math.max(5 * vh, 20) * 1.3,
        emoji: Math.max(5 * vh, 24),
        // How far a reaction rises at most (the mockup's 90 px on a 720 px frame).
        rise: 12.5 * vmin,
        gap: Math.max(2.5 * vmin, 8),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [active, fx.bubbles, fx.floats, tabs]);

  const byPid = new Map(players.map((p) => [p.pid, p]));
  const gap = 4;
  // Only bubbles whose chip is on show. Portrait stacks them from just under the strip's lowest
  // chip, as many as fit the room (the rest are in the feed); with no room at all, on the row.
  const stackTop = boxes ? Math.max(0, ...[...boxes.chips.values()].map((c) => c.bottom)) + gap : 0;
  const slots = boxes ? Math.floor((boxes.h - stackTop) / (boxes.bubbleHeight + gap)) : 0;
  const stack = !tabs && slots > 0;
  const shown = boxes ? fx.bubbles.filter((b) => boxes.chips.has(b.pid) && byPid.has(b.pid)) : [];
  const bubbles = stack ? shown.slice(-slots) : shown;

  const bubbleText = (b: (typeof bubbles)[number], name: string) =>
    b.text !== null ? (
      b.text
    ) : guessFeed === 'off' ? (
      // The 💬 pulses, not the text, so the text keeps its contrast.
      <>
        <span className="inline-block motion-safe:animate-pulse">💬</span>{' '}
        {t('isGuessing', { name })}
      </>
    ) : (
      '•••'
    );
  const BUBBLE =
    'max-w-full shrink-0 truncate border-solid bg-paper px-[0.45em] font-hand leading-[1.15] text-ink motion-safe:animate-bubble motion-reduce:animate-fade';
  const bubbleStyle = (color: string) => ({
    borderColor: color,
    borderWidth: 'max(2.5px, 0.35vmin)',
    fontSize: 'max(5vh, 20px)',
  });

  return (
    // Clips its own contents, so nothing in it ever makes the parent overflow.
    <div
      ref={layer}
      aria-hidden="true"
      data-fx={layout}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${tabs ? 'z-[3]' : ''}`}
    >
      {boxes &&
        bubbles.map((b, i) => {
          const chip = boxes.chips.get(b.pid)!;
          const p = byPid.get(b.pid)!;
          if (tabs) {
            const at = boxes.page
              ? placeTabBubble(chip, boxes.page, boxes.bubbleHeight, boxes.gap, boxes.h)
              : null;
            if (!at) return null;
            return (
              <div
                key={b.id}
                className="absolute flex justify-end"
                style={{ left: at.left, top: at.top, width: at.width, height: boxes.bubbleHeight }}
              >
                {/* The tail points at the tab, down and right. */}
                <p
                  className={`${BUBBLE} origin-right rounded-[0.7em_0.7em_0.15em_0.7em]`}
                  style={bubbleStyle(p.color)}
                >
                  {bubbleText(b, p.name)}
                </p>
              </div>
            );
          }
          const half = boxes.bubbleHeight / 2;
          let top: number;
          if (stack) {
            top = stackTop + i * (boxes.bubbleHeight + gap);
          } else {
            // Centred on the row, kept inside the parent top and bottom.
            const centre = (chip.top + chip.bottom) / 2;
            top = Math.min(Math.max(centre, half), Math.max(boxes.h - half, half)) - half;
          }
          return (
            <div
              key={b.id}
              className="absolute left-0 flex w-full"
              style={{ top, height: boxes.bubbleHeight }}
            >
              {/* Shrinks first, so a long bubble slides left rather than run off the edge. */}
              <span
                className="min-w-0 shrink"
                style={{ flexBasis: stack ? chip.left : chip.end + 6 }}
              />
              <p
                className={`${BUBBLE} ${stack ? 'origin-top-left rounded-[0.15em_0.7em_0.7em_0.7em]' : 'origin-left rounded-[0.7em_0.7em_0.7em_0.15em]'}`}
                style={bubbleStyle(p.color)}
              >
                {bubbleText(b, p.name)}
              </p>
            </div>
          );
        })}
      {boxes &&
        fx.floats.map((f) => {
          const chip = boxes.chips.get(f.pid);
          // A little sideways spread, so a burst doesn't stack into one emoji.
          const jitter = ((f.id * 37) % 5) - 2;
          // Tabs: from the tab's top corner (the mockup's). Portrait: just past the chip's name
          // (and points), from its top edge, so it rises away from the chip rather than cover it.
          // Either way kept inside the layer.
          const x = chip
            ? Math.min(tabs ? chip.right - boxes.emoji * 1.2 : chip.end + 4, boxes.w - boxes.emoji)
            : boxes.w / 2;
          const y = Math.min(boxes.h - boxes.emoji / 2, chip ? chip.top : boxes.h);
          // Rises as far as the layer lets it, up to the full 12.5 vmin, so it never runs into the
          // clipped edge.
          const rise = Math.max(0, Math.min(boxes.rise, y - boxes.emoji / 2));
          return (
            <span
              key={f.id}
              className="absolute leading-none motion-safe:animate-float-up motion-reduce:animate-fade"
              style={{
                left: `calc(${x}px + ${jitter * 0.3}em)`,
                top: `calc(${y}px - 0.5em)`,
                fontSize: 'max(5vh, 24px)',
                ['--rise' as string]: `${rise}px`,
              }}
            >
              {f.emoji}
            </span>
          );
        })}
    </div>
  );
}

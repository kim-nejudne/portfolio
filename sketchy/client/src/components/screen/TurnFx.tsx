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
  /** Each player's index tab. */
  chips: Map<string, Box>;
  /** The right page, where a tab's bubbles go (landscape). */
  page: Box | null;
  /** The lane between the drawing and the tabs, where a tab's bubbles go (portrait). */
  lane: Box | null;
  w: number;
  h: number;
  bubbleHeight: number;
  /** A reaction's size in px. */
  emoji: number;
  rise: number;
  /** The room between a bubble and its tab, and the page's edge. */
  gap: number;
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
 * Where a wrong-guess bubble from a portrait index tab goes: in the lane between the drawing and
 * the tabs, at its foot, just above the tab, never over the drawing. A tab in the lane's left half
 * starts the bubble at its own left edge (`align: 'start'`, the bubble runs right); one in the
 * right half ends it at its right edge (`'end'`, it runs left). A long guess is cut short at the
 * lane's edge. `null` when the lane can't hold one.
 */
export function placeLaneBubble(
  tab: Box,
  lane: Box,
  height: number,
): { left: number; width: number; top: number; align: 'start' | 'end' } | null {
  if (lane.bottom - lane.top < height || lane.right - lane.left < height) return null;
  const top = lane.bottom - height;
  const centre = (tab.left + tab.right) / 2;
  if (centre <= (lane.left + lane.right) / 2) {
    const left = Math.max(tab.left, lane.left);
    return { left, width: lane.right - left, top, align: 'start' };
  }
  const right = Math.min(tab.right, lane.right);
  return { left: lane.left, width: right - lane.left, top, align: 'end' };
}

/**
 * Wrong-guess speech bubbles and floating reactions (the mockup's sk-bubble and sk-float), drawn
 * from each player's index tab (`data-tab`). The layer lies over the whole desk. Landscape: a
 * bubble pops out left of the guesser's tab over the right page (`placeTabBubble`); portrait: up
 * from the tab into the lane under the drawing (`data-bubble-lane`, `placeLaneBubble`). Either way
 * never over the drawing. A reaction rises from the tab's top corner, in portrait only as far as
 * the lane's top. A bubble is paper with a border in the guesser's colour; under reduced motion
 * everything fades.
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
  layout: 'tabs';
  t: Translate;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<Boxes | null>(null);
  const active = fx.bubbles.length > 0 || fx.floats.length > 0;

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
      const chips = new Map<string, Box>();
      const parent = el.parentElement;
      for (const chip of parent?.querySelectorAll<HTMLElement>('[data-tab]') ?? [])
        chips.set(chip.dataset.tab!, local(chip.getBoundingClientRect()));
      const lane = parent?.querySelector<HTMLElement>('[data-bubble-lane]');
      const page = lane ? null : parent?.querySelector<HTMLElement>('[data-page="right"]');
      const vh = window.innerHeight / 100;
      const vmin = Math.min(window.innerWidth, window.innerHeight) / 100;
      setBoxes({
        chips,
        page: page ? local(page.getBoundingClientRect()) : null,
        lane: lane ? local(lane.getBoundingClientRect()) : null,
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
  }, [active, fx.bubbles, fx.floats]);

  const byPid = new Map(players.map((p) => [p.pid, p]));
  // Only bubbles whose tab is on show.
  const bubbles = boxes ? fx.bubbles.filter((b) => boxes.chips.has(b.pid) && byPid.has(b.pid)) : [];

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
      className="pointer-events-none absolute inset-0 z-[3] overflow-hidden"
    >
      {boxes &&
        bubbles.map((b) => {
          const chip = boxes.chips.get(b.pid)!;
          const p = byPid.get(b.pid)!;
          if (boxes.lane) {
            const at = placeLaneBubble(chip, boxes.lane, boxes.bubbleHeight);
            if (!at) return null;
            const start = at.align === 'start';
            return (
              <div
                key={b.id}
                className={`absolute flex ${start ? 'justify-start' : 'justify-end'}`}
                style={{ left: at.left, top: at.top, width: at.width, height: boxes.bubbleHeight }}
              >
                {/* The tail points down at the tab. */}
                <p
                  className={`${BUBBLE} ${start ? 'origin-bottom-left rounded-[0.7em_0.7em_0.7em_0.15em]' : 'origin-bottom-right rounded-[0.7em_0.7em_0.15em_0.7em]'}`}
                  style={bubbleStyle(p.color)}
                >
                  {bubbleText(b, p.name)}
                </p>
              </div>
            );
          }
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
        })}
      {boxes &&
        fx.floats.map((f) => {
          const chip = boxes.chips.get(f.pid);
          // A little sideways spread, so a burst doesn't stack into one emoji.
          const jitter = ((f.id * 37) % 5) - 2;
          // From the tab's top corner (the mockup's), kept inside the layer.
          const x = chip
            ? Math.min(chip.right - boxes.emoji * 1.2, boxes.w - boxes.emoji)
            : boxes.w / 2;
          const y = Math.min(boxes.h - boxes.emoji / 2, chip ? chip.top : boxes.h);
          // Rises up to the full 12.5 vmin, as far as the layer lets it (never into the clipped
          // edge) and, in portrait, no higher than the lane, so it never crosses the drawing.
          const ceiling = boxes.lane ? boxes.lane.top : 0;
          const rise = Math.max(0, Math.min(boxes.rise, y - ceiling - boxes.emoji / 2));
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

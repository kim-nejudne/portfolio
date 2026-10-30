import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { PlayerChipView, RoomSettings } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import type { ScreenLayout } from '../../lib/screen.js';
import type { GotIt, ScreenFxState } from '../../lib/screenFx.js';

/**
 * "Jun got it!" in Jun's colour (several names when they land together), for `ANNOUNCE_MS`. It
 * takes the place of a line in the sidebar or the portrait top bar, never the drawing's.
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
      className={`font-display origin-left truncate font-bold motion-safe:animate-pop ${className}`}
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

interface Boxes {
  chips: Map<string, ChipBox>;
  w: number;
  h: number;
  bubbleHeight: number;
  /** A reaction's size in px. */
  emoji: number;
  rise: number;
}

interface ChipBox {
  left: number;
  top: number;
  bottom: number;
  /** Where the chip's contents end (a sidebar row is wider than its name). */
  end: number;
}

/**
 * Wrong-guess speech bubbles and floating reactions, drawn from each player's chip (`data-chip`) in
 * the parent: the landscape sidebar or the portrait room under the drawing. The parent clips them
 * (`overflow-hidden`), so they never cover the drawing. Landscape: a bubble sits on its chip's
 * row, just after the name ("Bea 💬 sapatos"). Portrait: the strip's chips sit side by side, so the
 * bubbles stack under the strip, each starting under its chip. Either way a long one slides left
 * rather than run off the edge. A reaction rises from just past the chip's name, or from the
 * bottom when no chip is on show.
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
  layout: ScreenLayout;
  t: Translate;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<Boxes | null>(null);
  const active = fx.bubbles.length > 0 || fx.floats.length > 0;

  // Measured when a bubble or reaction comes; chips don't move while one is up.
  useLayoutEffect(() => {
    const el = layer.current;
    if (!el || !active) return;
    const origin = el.getBoundingClientRect();
    const chips = new Map<string, ChipBox>();
    for (const chip of el.parentElement?.querySelectorAll<HTMLElement>('[data-chip]') ?? []) {
      const r = chip.getBoundingClientRect();
      const end = Math.max(
        r.left,
        ...[...chip.children].map((c) => c.getBoundingClientRect().right),
      );
      chips.set(chip.dataset.chip!, {
        left: r.left - origin.left,
        top: r.top - origin.top,
        bottom: r.bottom - origin.top,
        end: end - origin.left,
      });
    }
    const vh = window.innerHeight / 100;
    setBoxes({
      chips,
      w: origin.width,
      h: origin.height,
      // Bubble text is at least 5 vh; with its padding a bubble is about 1.3 of that tall.
      bubbleHeight: Math.max(5 * vh, 20) * 1.3,
      emoji: Math.max(5 * vh, 24),
      // How far a reaction rises at most (float-up's default 14 vh).
      rise: 14 * vh,
    });
  }, [active, fx.bubbles, fx.floats]);

  const byPid = new Map(players.map((p) => [p.pid, p]));
  const gap = 4;
  // Only bubbles whose chip is on show. Portrait stacks them from just under the strip's lowest
  // chip, as many as fit the room (the rest are in the feed); with no room at all, on the row.
  const stackTop = boxes ? Math.max(0, ...[...boxes.chips.values()].map((c) => c.bottom)) + gap : 0;
  const slots = boxes ? Math.floor((boxes.h - stackTop) / (boxes.bubbleHeight + gap)) : 0;
  const stack = layout === 'portrait' && slots > 0;
  const shown = boxes ? fx.bubbles.filter((b) => boxes.chips.has(b.pid) && byPid.has(b.pid)) : [];
  const bubbles = stack ? shown.slice(-slots) : shown;

  return (
    // Clips its own contents, so nothing in it ever makes the parent overflow.
    <div
      ref={layer}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {boxes &&
        bubbles.map((b, i) => {
          const chip = boxes.chips.get(b.pid)!;
          const p = byPid.get(b.pid)!;
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
                className={`max-w-full shrink-0 truncate rounded-[0.8em] px-[0.45em] leading-[1.25] font-bold text-[#1D1B22] shadow-lg motion-safe:animate-bubble motion-reduce:animate-fade ${stack ? 'origin-top-left rounded-tl-[0.15em]' : 'origin-left rounded-bl-[0.15em]'}`}
                style={{ background: p.color, fontSize: 'max(5vh, 20px)' }}
              >
                {b.text !== null ? (
                  b.text
                ) : guessFeed === 'off' ? (
                  // The 💬 pulses, not the text, so the text keeps its contrast.
                  <>
                    <span className="inline-block motion-safe:animate-pulse">💬</span>{' '}
                    {t('isGuessing', { name: p.name })}
                  </>
                ) : (
                  '•••'
                )}
              </p>
            </div>
          );
        })}
      {boxes &&
        fx.floats.map((f) => {
          const chip = boxes.chips.get(f.pid);
          // A little sideways spread, so a burst doesn't stack into one emoji.
          const jitter = ((f.id * 37) % 5) - 2;
          // Just past the chip's name (and points), from its top edge, so it rises away from the
          // chip rather than cover it; kept inside the parent.
          const x = chip ? Math.min(chip.end + 4, boxes.w - boxes.emoji) : boxes.w / 2;
          const y = Math.min(boxes.h - boxes.emoji / 2, chip ? chip.top : boxes.h);
          // Rises as far as the parent lets it (the portrait strip sits near the top of its room),
          // up to float-up's full 14 vh, so it never runs into the clipped edge.
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

import { useState, type ReactNode } from 'react';
import { useMediaQuery } from '../lib/useMediaQuery.js';

const PAD = { phone: 'px-5 py-4', screen: 'px-4 py-3' } as const;

/**
 * The boarding-pass card (DESIGN.md "Boarding pass"): the one light surface, 14 px radius, a 6 px
 * stripe in the player's colour, the head above a dashed tear line with two notches, the rest below.
 */
export function BoardingPass({
  label,
  as: Tag = 'section',
  size = 'phone',
  color,
  emoji,
  heading,
  aside,
  className = '',
  children,
}: {
  label: string;
  as?: 'section' | 'li';
  size?: keyof typeof PAD;
  /** The player's colour, as the left stripe. */
  color?: string;
  emoji?: string;
  heading: ReactNode;
  /** Right of the heading: stamps, a timer, a label. */
  aside?: ReactNode;
  className?: string;
  /** Below the tear line; no tear without it. */
  children?: ReactNode;
}) {
  return (
    <Tag
      aria-label={label}
      className={`relative flex w-full min-w-0 flex-col overflow-hidden rounded-pass bg-pass-bg text-pass-text ${className}`}
    >
      {color && (
        <span
          aria-hidden="true"
          data-stripe
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ background: color }}
        />
      )}
      <div className={`flex items-center gap-3 ${PAD[size]}`}>
        {emoji && (
          <span aria-hidden="true" className="text-[32px] leading-none">
            {emoji}
          </span>
        )}
        <div className="min-w-0 flex-1">{heading}</div>
        {aside}
      </div>
      {children && (
        <>
          <div
            aria-hidden="true"
            data-tear
            className="relative border-t-2 border-dashed border-line"
          >
            {/* 12 px semicircle notches: board-coloured circles half clipped by the card. */}
            <span className="absolute -top-[13px] -left-3 size-6 rounded-full bg-board-bg" />
            <span className="absolute -top-[13px] -right-3 size-6 rounded-full bg-board-bg" />
          </div>
          <div className={`flex flex-col gap-2 ${PAD[size]}`}>{children}</div>
        </>
      )}
    </Tag>
  );
}

/**
 * A pass stamp, rotated −8°. BULLSEYE is `--delayed` ink as a fill (red text on the pass is 2.7:1),
 * CLOSEST is the pass's own ink (DECISIONS 62).
 */
export function Stamp({ tone, children }: { tone: 'bullseye' | 'closest'; children: string }) {
  const ink =
    tone === 'bullseye'
      ? 'border-delayed bg-delayed text-board-bg'
      : 'border-pass-text text-pass-text';
  return (
    <span
      className={`board-face inline-block shrink-0 -rotate-8 rounded-button border-2 px-2 py-0.5 text-sm ${ink}`}
    >
      {children}
    </span>
  );
}

/**
 * The face-down card turning over to `children` with a 500 ms Y rotation once `up` turns true. Only
 * a card that started face down flips; reduced motion fades the face in over 150 ms instead.
 */
export function PassFlip({
  up,
  back,
  children,
}: {
  up: boolean;
  back: ReactNode;
  children: ReactNode;
}) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [startedDown] = useState(!up);
  if (!startedDown) return children;
  if (reduced) return up ? <div className="flap-fade w-full">{children}</div> : back;
  return (
    <div className="pass-flip w-full" data-up={up}>
      <div className="pass-flip-inner">
        <div className="pass-face" aria-hidden={up || undefined}>
          {back}
        </div>
        <div className="pass-face pass-face-up">{up && children}</div>
      </div>
    </div>
  );
}

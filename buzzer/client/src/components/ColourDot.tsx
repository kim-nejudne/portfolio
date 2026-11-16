import type { HTMLAttributes } from 'react';

/**
 * A player's or team's colour as a dot in a 2px ink ring: red, blue and violet need it on the
 * green (design.md). `className` replaces the size and ring, for a dot on another ground. `square`
 * drops the rounding: Overprint squares every colour but the buzzer's corner chip (design.md Rules).
 */
export function ColourDot({
  color,
  className = 'size-[0.6em] ring-2 ring-ink',
  square = false,
  ...rest
}: { color: string; className?: string; square?: boolean } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden
      data-colour-dot
      {...rest}
      style={{ backgroundColor: color }}
      className={`inline-block shrink-0 ${square ? '' : 'rounded-full'} ${className}`}
    />
  );
}

import type { ComponentProps } from 'react';

/**
 * The sketch button (Sketchbook primitives): a hand-drawn `ink` border with a hard 3×4 px shadow,
 * Patrick Hand at 22 px, at least 48 px tall. `primary` is highlighter yellow, `ghost` is paper;
 * `full` fills the width at 60 px and 28 px type. Pressing collapses the shadow; hover dims
 * it (no white wash: no gradient fills); keyboard focus gets a `pen` outline.
 */
export function SketchButton({
  variant = 'primary',
  full = false,
  className = '',
  type = 'button',
  ...rest
}: {
  variant?: 'primary' | 'ghost';
  full?: boolean;
} & ComponentProps<'button'>) {
  return (
    <button
      type={type}
      data-variant={variant}
      className={`sketch-border inline-flex items-center justify-center px-[22px] py-1.5 font-hand leading-tight font-normal text-ink shadow-[3px_4px_0_var(--color-ink)] transition-[translate,box-shadow] duration-75 not-disabled:active:translate-x-[3px] not-disabled:active:translate-y-[4px] not-disabled:active:shadow-none hover:bg-none not-disabled:hover:brightness-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen disabled:opacity-50 ${
        variant === 'primary' ? 'bg-hl' : 'bg-paper'
      } ${full ? 'min-h-[60px] w-full text-[28px]' : 'min-h-12 text-[22px]'} ${className}`.trim()}
      {...rest}
    />
  );
}

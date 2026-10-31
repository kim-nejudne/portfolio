import type { ComponentProps } from 'react';

/**
 * `primary` highlighter, `ghost` paper, `armed` red pen: a two-tap control waiting for its second
 * tap ("Tap again to rematch", F61), unlike either resting look.
 */
export type SketchVariant = 'primary' | 'ghost' | 'armed';
const VARIANTS: Record<SketchVariant, string> = {
  primary: 'bg-hl text-ink',
  ghost: 'bg-paper text-ink',
  armed: 'bg-red text-paper',
};

/** `true`: full width at 60 px and 28 px type; `tall`: the same at 64 px (the Host sheet's Rematch). */
const SIZES = {
  false: 'min-h-12 text-[22px]',
  true: 'min-h-[60px] w-full text-[28px]',
  tall: 'min-h-16 w-full text-[28px]',
} as const;

/**
 * The sketch button's classes, for a `<button>` that can't be a `SketchButton` (one whose attribute
 * order a test pins).
 */
export function sketchButtonClass(
  variant: SketchVariant = 'primary',
  full: boolean | 'tall' = false,
): string {
  return `sketch-border inline-flex items-center justify-center px-[22px] py-1.5 font-hand leading-tight font-normal shadow-[3px_4px_0_var(--color-ink)] transition-[translate,box-shadow] duration-75 not-disabled:active:translate-x-[3px] not-disabled:active:translate-y-[4px] not-disabled:active:shadow-none hover:bg-none not-disabled:hover:brightness-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen disabled:opacity-50 ${
    VARIANTS[variant]
  } ${SIZES[String(full) as keyof typeof SIZES]}`;
}

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
  variant?: SketchVariant;
  full?: boolean;
} & ComponentProps<'button'>) {
  return (
    <button
      type={type}
      data-variant={variant}
      className={`${sketchButtonClass(variant, full)} ${className}`.trim()}
      {...rest}
    />
  );
}

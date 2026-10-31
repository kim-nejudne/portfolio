import type { ComponentPropsWithoutRef } from 'react';

/**
 * A sheet of the sketchbook (Sketchbook primitives): `paper` with a dot grid (`paper-dots`, every
 * 22 px) or ruled lines every 34 px with the red margin at 46 px (`paper-ruled`). Flat patterns,
 * not gradient fills. Text on a ruled page starts right of the margin (`pl-[62px]`).
 */
export function Paper({
  variant,
  className = '',
  ...rest
}: { variant: 'dots' | 'ruled' } & ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-paper={variant}
      className={`bg-paper text-ink ${variant === 'dots' ? 'paper-dots' : 'paper-ruled'} ${className}`.trim()}
      {...rest}
    />
  );
}

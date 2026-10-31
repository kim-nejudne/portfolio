/** The height of a row of rings across the top of a phone page (the drawer's Host pill sits under it). */
export const RINGS_ROW_PX = 30;

/**
 * The spiral wire (Sketchbook primitives): rounded `ring` loops half off the page edge, each over a
 * punched hole. Phones have a row across the top; the Screen spread has a column in its centre
 * gutter (landscape) or a row between its pages (portrait). Decoration only. A column fills its
 * parent's height, so the parent needs a definite one (a stretched flex item will do).
 */
export function SpiralRings({
  direction = 'row',
  count = 9,
  className = '',
}: {
  direction?: 'row' | 'column';
  count?: number;
  className?: string;
}) {
  const row = direction === 'row';
  return (
    <div
      aria-hidden
      data-rings={direction}
      style={row ? { height: RINGS_ROW_PX } : undefined}
      className={`pointer-events-none relative z-[2] flex shrink-0 justify-around ${
        row ? 'items-start px-[18px]' : 'h-full w-[34px] flex-col items-center py-[14px]'
      } ${className}`.trim()}
    >
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          className={`relative rounded-[8px] border-[3px] border-ring ${
            row
              ? '-mt-[10px] h-[26px] w-[12px] after:absolute after:-bottom-[9px] after:-left-px after:size-[8px] after:rounded-full after:bg-desk'
              : 'h-[12px] w-[46px]'
          }`}
        />
      ))}
    </div>
  );
}

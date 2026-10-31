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
      className={`pointer-events-none relative z-[2] flex shrink-0 justify-around ${
        row ? 'h-[30px] items-start px-[18px]' : 'h-full w-[34px] flex-col items-center py-[14px]'
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

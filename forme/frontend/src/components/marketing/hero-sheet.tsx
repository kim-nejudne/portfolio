import { ColourBar } from '@/components/furniture/marks';

/**
 * A B2 sheet, imposed nine up, drawn to scale: gripper edge, colour bar,
 * crop marks and gutters. No photography anywhere on this site.
 */
export function HeroSheet() {
  const sheet = { w: 500, h: 707 };
  const gripper = 10;
  const tail = 12;
  const page = { w: 154, h: 216 };
  const cols = 3;
  const rows = 3;
  const gridW = cols * page.w;
  const gridH = rows * page.h;
  const originX = (sheet.w - gridW) / 2;
  const originY = tail + (sheet.h - gripper - tail - gridH) / 2;

  return (
    <figure className="border border-rule-strong p-4">
      <svg
        viewBox={`-14 -14 ${sheet.w + 28} ${sheet.h + 28}`}
        className="block h-auto w-full text-ink"
        role="img"
        aria-label="A B2 sheet, 500 by 707 millimetres, imposed nine up with A5 pages, a 10 millimetre gripper edge and a colour bar on the tail."
      >
        <rect x="0" y="0" width={sheet.w} height={sheet.h} fill="none" stroke="currentColor" strokeWidth="1" />
        <g aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <rect
              key={index}
              x={originX + 8 + index * 26}
              y={4}
              width="22"
              height={tail - 8}
              fill={['#00A0D8', '#D6006E', '#F2B705', '#0B0B0B'][index]}
            />
          ))}
          <rect
            x="0"
            y={sheet.h - gripper}
            width={sheet.w}
            height={gripper}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.75"
            strokeDasharray="6 4"
          />
          {Array.from({ length: rows * cols }, (_, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = originX + col * page.w;
            const y = originY + row * page.h;
            return (
              <g key={index}>
                <rect x={x} y={y} width={page.w} height={page.h} fill="none" stroke="currentColor" strokeWidth="0.5" />
                <rect
                  x={x + 3}
                  y={y + 3}
                  width={page.w - 6}
                  height={page.h - 6}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.4"
                  strokeDasharray="3 3"
                />
                <text
                  x={x + page.w / 2}
                  y={y + page.h / 2 + 6}
                  fontFamily="IBM Plex Mono, monospace"
                  fontSize="18"
                  textAnchor="middle"
                  fill="currentColor"
                >
                  {(index + 1).toString().padStart(2, '0')}
                </text>
              </g>
            );
          })}
          <text x="0" y="-4" fontFamily="IBM Plex Mono, monospace" fontSize="13" fill="currentColor">
            B2 500 × 707mm
          </text>
          <text
            x={sheet.w}
            y={sheet.h + 11}
            fontFamily="IBM Plex Mono, monospace"
            fontSize="13"
            textAnchor="end"
            fill="currentColor"
          >
            GRIPPER 10mm
          </text>
        </g>
      </svg>
      <figcaption className="mt-3 border-t border-rule pt-2 text-xs text-muted">
        A5 nine up on B2, 3mm bleed shared between pieces, colour bar on the tail, 10mm gripper.
        This is what the imposition planner draws for every job.
      </figcaption>
      <div className="mt-3">
        <ColourBar height={10} />
      </div>
    </figure>
  );
}

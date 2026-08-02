import type { ImpositionPlan } from '@/lib/types';

const TAIL_MM = 12;

/**
 * The imposed sheet, drawn from arithmetic. Pages sit at true relative
 * proportions, numbered, inverted where the fold scheme inverts them.
 */
export function ImposedSheet({
  plan,
  side,
}: {
  plan: ImpositionPlan;
  side: 'FRONT' | 'BACK';
}) {
  const form = plan.forms.find((entry) => entry.side === side) ?? plan.forms[0];
  const { sheetWidthMm: width, sheetHeightMm: height } = plan;
  const gripperY = height - plan.input.gripperMm;
  const pad = 22;
  const stroke = plan.fits ? 'currentColor' : '#D6006E';

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`}
      className="anim-fade block h-auto w-full text-ink"
      role="img"
      aria-label={`${side} form: ${plan.upCount} pages up on a ${width} by ${height} millimetre sheet.`}
      data-testid={`imposed-sheet-${side.toLowerCase()}`}
    >
      <rect x="0" y="0" width={width} height={height} fill="#FFFFFF" stroke="currentColor" strokeWidth="1" />

      <g aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <rect
            key={index}
            x={width / 2 - 60 + index * 30}
            y={3}
            width={26}
            height={TAIL_MM - 6}
            fill={['#00A0D8', '#D6006E', '#F2B705', '#0B0B0B'][index]}
          />
        ))}
        <text x={8} y={TAIL_MM - 3} fontFamily="IBM Plex Mono, monospace" fontSize="7" fill="currentColor">
          COLOUR BAR
        </text>

        <rect
          x="0"
          y={gripperY}
          width={width}
          height={plan.input.gripperMm}
          fill="#0B0B0B"
          fillOpacity="0.07"
        />
        <path d={`M0 ${gripperY}H${width}`} stroke="currentColor" strokeWidth="0.8" strokeDasharray="6 4" />
        <text
          x={width - 8}
          y={height - 3}
          fontFamily="IBM Plex Mono, monospace"
          fontSize="7"
          textAnchor="end"
          fill="currentColor"
        >
          GRIPPER {plan.input.gripperMm}mm
        </text>
      </g>

      {form.pages.map((page) => {
        const cx = page.xMm + page.widthMm / 2;
        const cy = page.yMm + page.heightMm / 2;
        return (
          <g key={page.key}>
            <rect
              x={page.xMm}
              y={page.yMm}
              width={page.widthMm}
              height={page.heightMm}
              fill="none"
              stroke={stroke}
              strokeWidth={plan.fits ? 0.7 : 1.2}
              strokeDasharray={plan.fits ? undefined : '6 3'}
            />
            <g aria-hidden="true" stroke="currentColor" strokeWidth="0.4">
              <path d={`M${page.xMm} ${page.yMm - 6}V${page.yMm - 1}`} />
              <path d={`M${page.xMm + page.widthMm} ${page.yMm - 6}V${page.yMm - 1}`} />
              <path d={`M${page.xMm - 6} ${page.yMm}H${page.xMm - 1}`} />
              <path
                d={`M${page.xMm + page.widthMm + 1} ${page.yMm + page.heightMm}H${page.xMm + page.widthMm + 6}`}
              />
            </g>
            <text
              x={cx}
              y={cy + 10}
              fontFamily="IBM Plex Mono, monospace"
              fontSize="26"
              textAnchor="middle"
              fill={stroke}
              transform={page.rotated ? `rotate(180 ${cx} ${cy})` : undefined}
            >
              {page.label}
            </text>
            {page.rotated ? (
              <text
                x={cx}
                y={cy + 22}
                fontFamily="IBM Plex Mono, monospace"
                fontSize="7"
                textAnchor="middle"
                fill="currentColor"
                fillOpacity="0.55"
              >
                INVERTED
              </text>
            ) : null}
          </g>
        );
      })}

      <text x="0" y="-8" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="currentColor">
        {side} FORM · {form.plate} · {width} × {height}mm
      </text>
      {plan.fits ? null : (
        <text
          x={width}
          y={height + 18}
          fontFamily="IBM Plex Mono, monospace"
          fontSize="9"
          textAnchor="end"
          fill="#D6006E"
        >
          PAGES OVER THE SHEET EDGE
        </text>
      )}
    </svg>
  );
}

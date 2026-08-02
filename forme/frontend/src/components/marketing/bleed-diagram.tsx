/**
 * Trim, bleed and safety, drawn to scale on an A5 page. Millimetres are labelled
 * because that is the only unit anyone on the floor will accept.
 */
export function BleedDiagram() {
  const trim = { w: 148, h: 210 };
  const bleed = 3;
  const safety = 4;
  const pad = 34;
  const originX = pad + bleed;
  const originY = pad + bleed;

  return (
    <figure className="border border-rule-strong p-4">
      <svg
        viewBox={`0 0 ${trim.w + bleed * 2 + pad * 2} ${trim.h + bleed * 2 + pad * 2}`}
        className="block h-auto w-full text-ink"
        role="img"
        aria-label="An A5 page at 148 by 210 millimetres with a 3 millimetre bleed box outside the trim and a 4 millimetre safety margin inside it."
      >
        <rect
          x={pad}
          y={pad}
          width={trim.w + bleed * 2}
          height={trim.h + bleed * 2}
          fill="none"
          stroke="#00A0D8"
          strokeWidth="1"
          strokeDasharray="5 3"
        />
        <rect x={originX} y={originY} width={trim.w} height={trim.h} fill="none" stroke="currentColor" strokeWidth="1.2" />
        <rect
          x={originX + safety}
          y={originY + safety}
          width={trim.w - safety * 2}
          height={trim.h - safety * 2}
          fill="none"
          stroke="#D6006E"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <g stroke="currentColor" strokeWidth="0.6" aria-hidden="true">
          <path d={`M${pad - 10} ${pad}H${pad - 2}`} />
          <path d={`M${pad - 10} ${pad + bleed * 2 + trim.h}H${pad - 2}`} />
          <path d={`M${pad - 6} ${pad}V${pad + bleed * 2 + trim.h}`} />
          <path d={`M${originX} ${pad - 10}V${pad - 2}`} />
          <path d={`M${originX + trim.w} ${pad - 10}V${pad - 2}`} />
          <path d={`M${originX} ${pad - 6}H${originX + trim.w}`} />
        </g>
        <g fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="currentColor">
          <text x={originX + trim.w / 2} y={pad - 14} textAnchor="middle">
            TRIM 148mm
          </text>
          <text
            x={pad - 16}
            y={pad + (trim.h + bleed * 2) / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${pad - 16} ${pad + (trim.h + bleed * 2) / 2})`}
          >
            BLEED BOX 216mm
          </text>
          <text x={pad} y={pad + trim.h + bleed * 2 + 16} fill="#00A0D8">
            BLEED 3mm outside trim
          </text>
          <text x={originX + safety + 4} y={originY + safety + 14} fill="#D6006E">
            SAFETY 4mm inside trim
          </text>
          <text x={originX + 4} y={originY + trim.h - 8}>
            A5 148 × 210mm
          </text>
        </g>
      </svg>
      <figcaption className="mt-3 border-t border-rule pt-2 text-xs text-muted">
        Cyan is the bleed box, 3mm outside the trim on all four edges. Magenta is the safety
        margin, 4mm inside the trim. Nothing that must survive the guillotine goes outside the
        magenta line; anything that must reach the edge must cross the cyan one.
      </figcaption>
    </figure>
  );
}

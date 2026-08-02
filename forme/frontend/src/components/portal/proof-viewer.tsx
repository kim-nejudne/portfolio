'use client';

import { useId, useState } from 'react';
import { CropFrame, RegistrationTarget } from '@/components/furniture/marks';

const INKS = [
  { key: 'C', label: 'Cyan', colour: '#00A0D8' },
  { key: 'M', label: 'Magenta', colour: '#D6006E' },
  { key: 'Y', label: 'Yellow', colour: '#F2B705' },
  { key: 'K', label: 'Black', colour: '#0B0B0B' },
];

/** The artwork itself, drawn. There is no PDF renderer in this build. */
function Artwork({
  reference,
  tone,
  showBleed,
  showSafety,
  panelTone,
}: {
  reference: string;
  tone: string;
  showBleed: boolean;
  showSafety: boolean;
  panelTone: string;
}) {
  const trim = { w: 148, h: 210 };
  return (
    <svg
      viewBox="-6 -6 160 222"
      className="block h-auto w-full"
      role="img"
      aria-label={`Proof page for ${reference}, A5 portrait, drawn preview`}
    >
      <rect x="-3" y="-3" width={trim.w + 6} height={trim.h + 6} fill="#FFFFFF" />
      <g fill={tone}>
        <rect x="16" y="22" width="78" height="9" />
        <rect x="16" y="35" width="52" height="9" />
        <rect x="16" y="56" width="116" height="1.4" />
      </g>
      <rect x="16" y="66" width="116" height="64" fill="none" stroke={tone} strokeWidth="0.8" />
      <path d="M16 66 132 130M132 66 16 130" stroke={tone} strokeWidth="0.5" />
      <rect x="96" y="140" width="36" height="36" fill={panelTone} />
      <g fill={tone}>
        {Array.from({ length: 9 }, (_, index) => (
          <rect
            key={index}
            x="16"
            y={140 + index * 4.4}
            width={index % 3 === 2 ? 46 : 72}
            height="1.6"
          />
        ))}
        <rect x="16" y="190" width="28" height="1.4" />
      </g>
      <text x="16" y="200" fontFamily="IBM Plex Mono, monospace" fontSize="4.2" fill={tone}>
        {reference}
      </text>
      {showBleed ? (
        <rect
          x="-3"
          y="-3"
          width={trim.w + 6}
          height={trim.h + 6}
          fill="none"
          stroke="#00A0D8"
          strokeWidth="0.7"
          strokeDasharray="4 2"
        />
      ) : null}
      {showSafety ? (
        <rect
          x="4"
          y="4"
          width={trim.w - 8}
          height={trim.h - 8}
          fill="none"
          stroke="#D6006E"
          strokeWidth="0.7"
          strokeDasharray="3 2"
        />
      ) : null}
      <rect x="0" y="0" width={trim.w} height={trim.h} fill="none" stroke="#0B0B0B" strokeWidth="0.4" />
    </svg>
  );
}

export function ProofViewer({
  reference,
  fileName,
  warnings,
}: {
  reference: string;
  fileName: string;
  warnings: readonly string[];
}) {
  const [bleed, setBleed] = useState(true);
  const [safety, setSafety] = useState(false);
  const [separations, setSeparations] = useState(false);
  const id = useId();

  const toggle = (
    key: string,
    label: string,
    value: boolean,
    set: (next: boolean) => void,
    testId: string,
  ) => (
    <label key={key} className="flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => set(event.target.checked)}
        className="size-3.5 accent-cyan"
        data-testid={testId}
      />
      <span>{label}</span>
    </label>
  );

  return (
    <section aria-labelledby={`${id}-heading`} className="border border-rule-strong" data-testid="proof-viewer">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-rule-strong px-3 py-2">
        <h2 id={`${id}-heading`} className="label-caps">
          Proof sheet
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          {toggle('bleed', 'Bleed guides', bleed, setBleed, 'proof-toggle-bleed')}
          {toggle('safety', 'Safety margin', safety, setSafety, 'proof-toggle-safety')}
          {toggle('seps', 'Separations', separations, setSeparations, 'proof-toggle-separations')}
        </div>
      </div>

      <div className="bg-skeleton px-4 py-4">
        {separations ? (
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="proof-separations">
            {INKS.map((ink) => (
              <li key={ink.key} className="bg-paper">
                <CropFrame>
                  <Artwork
                    reference={reference}
                    tone={ink.colour}
                    panelTone={ink.key === 'C' ? ink.colour : '#FFFFFF'}
                    showBleed={bleed}
                    showSafety={safety}
                  />
                </CropFrame>
                <p className="num border-t border-rule px-2 py-1 text-2xs">
                  {ink.key} · {ink.label}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mx-auto max-w-[26rem] bg-paper">
            <CropFrame>
              <Artwork
                reference={reference}
                tone="#0B0B0B"
                panelTone="#00A0D8"
                showBleed={bleed}
                showSafety={safety}
              />
            </CropFrame>
          </div>
        )}
      </div>

      <dl className="num grid grid-cols-2 gap-px border-t border-rule bg-rule text-xs sm:grid-cols-4">
        <div className="bg-paper px-3 py-2">
          <dt className="label-caps text-muted">Page</dt>
          <dd>1 of 1 shown</dd>
        </div>
        <div className="bg-paper px-3 py-2">
          <dt className="label-caps text-muted">Trim</dt>
          <dd>148 × 210mm</dd>
        </div>
        <div className="bg-paper px-3 py-2">
          <dt className="label-caps text-muted">Bleed</dt>
          <dd>3mm all round</dd>
        </div>
        <div className="flex items-center gap-2 bg-paper px-3 py-2">
          <RegistrationTarget size={14} />
          <dd className="truncate" title={fileName}>
            {fileName}
          </dd>
        </div>
      </dl>

      {warnings.length > 0 ? (
        <div className="border-t border-rule px-3 py-2">
          <p className="label-caps text-muted">Warnings printed on this proof</p>
          <ul className="mt-1 space-y-1 text-xs">
            {warnings.map((warning) => (
              <li key={warning} className="flex gap-2">
                <span aria-hidden="true" className="num text-yellow">
                  △
                </span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

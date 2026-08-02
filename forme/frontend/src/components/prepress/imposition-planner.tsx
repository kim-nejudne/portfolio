'use client';

import { useMemo, useState } from 'react';
import { ImposedSheet } from '@/components/prepress/imposed-sheet';
import { SHEETS, buildPlan } from '@/lib/api/imposition';
import { BINDING_LABEL, SCHEME_LABEL, WORK_STYLE_LABEL } from '@/lib/domain';
import { formatInteger } from '@/lib/money';
import type {
  BindingStyle,
  ImpositionInput,
  SheetId,
  SignatureScheme,
  SizeId,
  WorkStyle,
} from '@/lib/types';

const FIELD =
  'h-7 w-full border border-rule-strong bg-paper px-1.5 num text-xs focus:border-ink';
const SHEET_IDS: readonly SheetId[] = ['SRA3', 'B2', 'B1'];
const SCHEMES: readonly SignatureScheme[] = ['4pp', '8pp', '16pp'];
const BINDINGS: readonly BindingStyle[] = ['saddle-stitch', 'perfect-bound', 'none'];
const STYLES: readonly WorkStyle[] = ['sheetwise', 'work-and-turn', 'work-and-tumble'];

export function ImpositionPlanner({
  initial,
  sizeId,
  trimWidthMm,
  trimHeightMm,
}: {
  initial: ImpositionInput;
  sizeId: SizeId;
  trimWidthMm: number;
  trimHeightMm: number;
}) {
  const [input, setInput] = useState<ImpositionInput>(initial);
  const [side, setSide] = useState<'FRONT' | 'BACK'>('FRONT');
  const plan = useMemo(
    () => buildPlan({ ...input, sizeId }, trimWidthMm, trimHeightMm),
    [input, sizeId, trimWidthMm, trimHeightMm],
  );
  const flat = input.binding === 'none';

  function set<K extends keyof ImpositionInput>(key: K, value: ImpositionInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  return (
    <section aria-labelledby="imposition" className="border border-rule-strong" data-testid="imposition-planner">
      <div className="flex items-center justify-between border-b-2 border-rule-strong px-3 py-2">
        <h2 id="imposition" className="label-caps">
          Imposition planner
        </h2>
        <span className="num text-2xs text-muted">
          {trimWidthMm} × {trimHeightMm}mm · {input.pageCount}pp · {formatInteger(input.quantity)}{' '}
          copies
        </span>
      </div>

      <div className="grid gap-3 border-b border-rule px-3 py-3 sm:grid-cols-3">
        <p>
          <label htmlFor="imp-sheet" className="label-caps text-muted">
            Sheet
          </label>
          <select
            id="imp-sheet"
            value={input.sheetId}
            onChange={(event) => set('sheetId', event.target.value as SheetId)}
            className={FIELD}
            data-testid="imposition-sheet"
          >
            {SHEET_IDS.map((id) => (
              <option key={id} value={id}>
                {SHEETS[id].label}
              </option>
            ))}
          </select>
        </p>
        <p>
          <label htmlFor="imp-scheme" className="label-caps text-muted">
            Signature
          </label>
          <select
            id="imp-scheme"
            value={input.scheme}
            onChange={(event) => set('scheme', event.target.value as SignatureScheme)}
            disabled={flat}
            className={`${FIELD} disabled:text-muted`}
            data-testid="imposition-scheme"
          >
            {SCHEMES.map((scheme) => (
              <option key={scheme} value={scheme}>
                {SCHEME_LABEL[scheme]}
              </option>
            ))}
          </select>
        </p>
        <p>
          <label htmlFor="imp-binding" className="label-caps text-muted">
            Binding
          </label>
          <select
            id="imp-binding"
            value={input.binding}
            onChange={(event) => set('binding', event.target.value as BindingStyle)}
            className={FIELD}
            data-testid="imposition-binding"
          >
            {BINDINGS.map((binding) => (
              <option key={binding} value={binding}>
                {BINDING_LABEL[binding]}
              </option>
            ))}
          </select>
        </p>
        <p>
          <label htmlFor="imp-style" className="label-caps text-muted">
            Work style
          </label>
          <select
            id="imp-style"
            value={input.workStyle}
            onChange={(event) => set('workStyle', event.target.value as WorkStyle)}
            className={FIELD}
            data-testid="imposition-work-style"
          >
            {STYLES.map((style) => (
              <option key={style} value={style}>
                {WORK_STYLE_LABEL[style]}
              </option>
            ))}
          </select>
        </p>
        <p>
          <label htmlFor="imp-gripper" className="label-caps text-muted">
            Gripper mm
          </label>
          <input
            id="imp-gripper"
            type="number"
            min={8}
            max={24}
            step={1}
            value={input.gripperMm}
            onChange={(event) => set('gripperMm', Number(event.target.value) || 10)}
            className={FIELD}
            data-testid="imposition-gripper"
          />
        </p>
        <p>
          <label htmlFor="imp-creep" className="label-caps text-muted">
            Creep mm
          </label>
          <input
            id="imp-creep"
            type="number"
            min={0}
            max={4}
            step={0.1}
            value={input.creepMm}
            onChange={(event) => set('creepMm', Number(event.target.value) || 0)}
            className={FIELD}
            data-testid="imposition-creep"
          />
        </p>
      </div>

      <div className="flex items-center justify-between border-b border-rule px-3 py-1.5">
        <div className="flex gap-3">
          {(['FRONT', 'BACK'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSide(option)}
              disabled={flat && option === 'BACK'}
              aria-pressed={side === option}
              data-testid={`imposition-side-${option.toLowerCase()}`}
              className={`label-caps border-b pb-0.5 transition-colors duration-100 ${
                side === option ? 'border-ink text-ink' : 'border-transparent text-muted'
              } disabled:text-rule-strong`}
            >
              {option} form
            </button>
          ))}
        </div>
        <span className={`num text-2xs ${plan.fits ? 'text-muted' : 'text-magenta'}`}>
          {plan.fits ? 'FITS' : 'DOES NOT FIT'}
        </span>
      </div>

      <div className="bg-skeleton px-4 py-4">
        <div className="mx-auto max-w-[26rem] bg-paper p-2">
          <ImposedSheet plan={plan} side={flat ? 'FRONT' : side} />
        </div>
      </div>

      <p className={`border-t border-rule px-3 py-2 text-xs ${plan.fits ? 'text-muted' : 'text-magenta'}`}>
        {plan.fitNote}
      </p>

      <dl className="num grid grid-cols-2 gap-px border-t border-rule bg-rule text-xs sm:grid-cols-4">
        <div className="bg-paper px-3 py-2">
          <dt className="label-caps text-muted">Up per form</dt>
          <dd data-testid="imposition-up">{plan.upCount}</dd>
        </div>
        <div className="bg-paper px-3 py-2">
          <dt className="label-caps text-muted">Sections per copy</dt>
          <dd>{plan.signatures}</dd>
        </div>
        <div className="bg-paper px-3 py-2">
          <dt className="label-caps text-muted">Sheets required</dt>
          <dd data-testid="imposition-sheets">{formatInteger(plan.sheetsRequired)}</dd>
        </div>
        <div className="bg-paper px-3 py-2">
          <dt className="label-caps text-muted">Waste allowance</dt>
          <dd>{formatInteger(plan.wasteSheets)}</dd>
        </div>
      </dl>

      <div className="border-t border-rule px-3 py-3">
        <h3 className="label-caps text-muted">Fold sequence</h3>
        <ol className="mt-2 space-y-1 text-xs">
          {plan.foldSequence.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="num text-2xs text-muted">
                {(index + 1).toString().padStart(2, '0')}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

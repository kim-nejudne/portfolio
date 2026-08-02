'use client';

import { useRef, useState } from 'react';
import { savePriceCellAction } from '@/lib/actions/pricing';
import { formatMultiplier, formatPeso } from '@/lib/money';
import type { PriceCellGroup, PriceEditResult, PriceMatrix } from '@/lib/types';

interface CellState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  message: string;
}

const IDLE: CellState = { status: 'idle', message: '' };

export function PricingMatrix({ matrix }: { matrix: PriceMatrix }) {
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const root = useRef<HTMLDivElement>(null);

  function focusCell(id: string) {
    const node = root.current?.querySelector<HTMLInputElement>(`[data-cellid="${id}"]`);
    if (node) {
      node.focus();
      node.select();
    }
  }

  async function commit(
    key: string,
    group: PriceCellGroup,
    rowId: string,
    field: string,
    raw: string,
  ) {
    const value = Number(raw);
    setCells((current) => ({ ...current, [key]: { status: 'saving', message: 'Saving' } }));
    const result: PriceEditResult = await savePriceCellAction({ group, rowId, field, value });
    setCells((current) => ({
      ...current,
      [key]: {
        status: result.ok ? 'saved' : 'error',
        message: result.message,
      },
    }));
  }

  function Cell({
    table,
    group,
    rowId,
    field,
    row,
    col,
    value,
    label,
    preview,
  }: {
    table: string;
    group: PriceCellGroup;
    rowId: string;
    field: string;
    row: number;
    col: number;
    value: number;
    label: string;
    preview?: string;
  }) {
    const key = `${group}-${rowId}-${field}`;
    const id = `${table}-${row}-${col}`;
    const state = cells[key] ?? IDLE;
    return (
      <td className="border-l border-rule px-1 py-0.5 align-top">
        <label htmlFor={`in-${key}`} className="sr-only">
          {label}
        </label>
        <input
          id={`in-${key}`}
          data-cellid={id}
          data-testid={`pricing-cell-${key}`}
          type="number"
          step={1}
          defaultValue={value}
          aria-invalid={state.status === 'error' ? true : undefined}
          aria-describedby={state.status === 'error' ? `msg-${key}` : undefined}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              focusCell(`${table}-${row + 1}-${col}`);
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              focusCell(`${table}-${row - 1}-${col}`);
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          onBlur={(event) => {
            if (event.target.value === value.toString()) return;
            void commit(key, group, rowId, field, event.target.value);
          }}
          className={`h-6 w-full border bg-paper px-1 text-right num text-xs focus:border-ink ${
            state.status === 'error' ? 'border-magenta' : 'border-transparent hover:border-rule'
          }`}
        />
        <span className="num mt-0.5 block text-right text-3xs text-muted">
          {state.status === 'saving'
            ? 'SAVING'
            : state.status === 'saved'
              ? 'SAVED'
              : (preview ?? '')}
        </span>
        {state.status === 'error' ? (
          <span
            id={`msg-${key}`}
            className="mt-0.5 block text-3xs text-magenta"
            data-testid={`pricing-error-${key}`}
          >
            {state.message}
          </span>
        ) : null}
      </td>
    );
  }

  const th = 'border-l border-rule px-2 py-1.5 text-left label-caps first:border-l-0';
  const tdLabel = 'px-2 py-1 text-xs';

  return (
    <div ref={root} className="space-y-8" data-testid="pricing-matrix">
      <section aria-labelledby="rates">
        <h2 id="rates" className="label-caps border-b-2 border-ink pb-1">
          Base rates per product
        </h2>
        <table className="mt-2 w-full table-fixed border border-rule-strong text-xs">
          <caption className="sr-only">Base rates per product, in whole pesos</caption>
          <thead>
            <tr className="border-b-2 border-rule-strong">
              <th scope="col" className={`${th} w-[14rem]`}>Product</th>
              <th scope="col" className={`${th} w-[8rem] text-right`}>Setup</th>
              <th scope="col" className={`${th} w-[9rem] text-right`}>Per 1,000</th>
              <th scope="col" className={th}>Note</th>
            </tr>
          </thead>
          <tbody>
            {matrix.products.map((product, index) => (
              <tr key={product.id} className="border-b border-rule last:border-b-0">
                <th scope="row" className={`${tdLabel} text-left font-normal`}>{product.label}</th>
                <Cell
                  table="products"
                  group="products"
                  rowId={product.id}
                  field="setup"
                  row={index}
                  col={0}
                  value={product.setup}
                  label={`${product.label} setup, whole pesos`}
                  preview={formatPeso(product.setup)}
                />
                <Cell
                  table="products"
                  group="products"
                  rowId={product.id}
                  field="perThousand"
                  row={index}
                  col={1}
                  value={product.perThousand}
                  label={`${product.label} rate per thousand, whole pesos`}
                  preview={formatPeso(product.perThousand)}
                />
                <td className={`${tdLabel} border-l border-rule text-muted`}>{product.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="stocks">
        <h2 id="stocks" className="label-caps border-b-2 border-ink pb-1">
          Stock multipliers
        </h2>
        <table className="mt-2 w-full table-fixed border border-rule-strong text-xs">
          <caption className="sr-only">Stock multipliers, per-mille</caption>
          <thead>
            <tr className="border-b-2 border-rule-strong">
              <th scope="col" className={`${th} w-[16rem]`}>Stock</th>
              <th scope="col" className={`${th} w-[6rem] text-right`}>GSM</th>
              <th scope="col" className={`${th} w-[8rem]`}>Surface</th>
              <th scope="col" className={`${th} w-[8rem] text-right`}>Ink limit</th>
              <th scope="col" className={`${th} w-[9rem] text-right`}>Multiplier</th>
              <th scope="col" className={th}>Reads as</th>
            </tr>
          </thead>
          <tbody>
            {matrix.stocks.map((stock, index) => (
              <tr key={stock.id} className="border-b border-rule last:border-b-0">
                <th scope="row" className={`${tdLabel} text-left font-normal`}>{stock.label}</th>
                <td className={`${tdLabel} border-l border-rule text-right num`}>{stock.gsm}</td>
                <td className={`${tdLabel} border-l border-rule num text-muted`}>
                  {stock.coated ? 'Coated' : 'Uncoated'}
                </td>
                <td className={`${tdLabel} border-l border-rule text-right num`}>{stock.inkLimit}%</td>
                <Cell
                  table="stocks"
                  group="stocks"
                  rowId={stock.id}
                  field="multiplier"
                  row={index}
                  col={0}
                  value={stock.multiplier}
                  label={`${stock.label} multiplier, per-mille`}
                />
                <td className={`${tdLabel} border-l border-rule num text-muted`}>
                  {formatMultiplier(stock.multiplier)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <section aria-labelledby="breaks">
          <h2 id="breaks" className="label-caps border-b-2 border-ink pb-1">
            Quantity break points
          </h2>
          <table className="mt-2 w-full table-fixed border border-rule-strong text-xs">
            <caption className="sr-only">Quantity break multipliers</caption>
            <thead>
              <tr className="border-b-2 border-rule-strong">
                <th scope="col" className={`${th} w-[8rem] text-right`}>Quantity</th>
                <th scope="col" className={`${th} w-[9rem] text-right`}>Multiplier</th>
                <th scope="col" className={th}>Reads as</th>
              </tr>
            </thead>
            <tbody>
              {matrix.quantityBreaks.map((band, index) => (
                <tr key={band.quantity} className="border-b border-rule last:border-b-0">
                  <th scope="row" className={`${tdLabel} text-right font-normal num`}>
                    {band.quantity}
                  </th>
                  <Cell
                    table="breaks"
                    group="quantityBreaks"
                    rowId={band.quantity.toString()}
                    field="multiplier"
                    row={index}
                    col={0}
                    value={band.multiplier}
                    label={`Multiplier at ${band.quantity}`}
                  />
                  <td className={`${tdLabel} border-l border-rule num text-muted`}>
                    {formatMultiplier(band.multiplier)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="turnarounds">
          <h2 id="turnarounds" className="label-caps border-b-2 border-ink pb-1">
            Turnaround multipliers
          </h2>
          <table className="mt-2 w-full table-fixed border border-rule-strong text-xs">
            <caption className="sr-only">Turnaround lead times and multipliers</caption>
            <thead>
              <tr className="border-b-2 border-rule-strong">
                <th scope="col" className={`${th} w-[9rem]`}>Turnaround</th>
                <th scope="col" className={`${th} w-[8rem] text-right`}>Days</th>
                <th scope="col" className={`${th} w-[9rem] text-right`}>Multiplier</th>
                <th scope="col" className={th}>Reads as</th>
              </tr>
            </thead>
            <tbody>
              {matrix.turnarounds.map((turnaround, index) => (
                <tr key={turnaround.id} className="border-b border-rule last:border-b-0">
                  <th scope="row" className={`${tdLabel} text-left font-normal`}>
                    {turnaround.label}
                  </th>
                  <Cell
                    table="turnarounds"
                    group="turnarounds"
                    rowId={turnaround.id}
                    field="workingDays"
                    row={index}
                    col={0}
                    value={turnaround.workingDays}
                    label={`${turnaround.label} working days`}
                  />
                  <Cell
                    table="turnarounds"
                    group="turnarounds"
                    rowId={turnaround.id}
                    field="multiplier"
                    row={index}
                    col={1}
                    value={turnaround.multiplier}
                    label={`${turnaround.label} multiplier, per-mille`}
                  />
                  <td className={`${tdLabel} border-l border-rule num text-muted`}>
                    {formatMultiplier(turnaround.multiplier)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section aria-labelledby="finishing">
        <h2 id="finishing" className="label-caps border-b-2 border-ink pb-1">
          Finishing surcharges
        </h2>
        <table className="mt-2 w-full table-fixed border border-rule-strong text-xs">
          <caption className="sr-only">Finishing surcharges, in whole pesos</caption>
          <thead>
            <tr className="border-b-2 border-rule-strong">
              <th scope="col" className={`${th} w-[14rem]`}>Finishing</th>
              <th scope="col" className={`${th} w-[10rem] text-right`}>Per 1,000</th>
              <th scope="col" className={`${th} w-[10rem] text-right`}>Flat</th>
              <th scope="col" className={th}>Line</th>
            </tr>
          </thead>
          <tbody>
            {matrix.finishing.map((finish, index) => (
              <tr key={finish.id} className="border-b border-rule last:border-b-0">
                <th scope="row" className={`${tdLabel} text-left font-normal`}>{finish.label}</th>
                <Cell
                  table="finishing"
                  group="finishing"
                  rowId={finish.id}
                  field="perThousand"
                  row={index}
                  col={0}
                  value={finish.perThousand}
                  label={`${finish.label} rate per thousand, whole pesos`}
                  preview={formatPeso(finish.perThousand)}
                />
                <Cell
                  table="finishing"
                  group="finishing"
                  rowId={finish.id}
                  field="flat"
                  row={index}
                  col={1}
                  value={finish.flat}
                  label={`${finish.label} flat charge, whole pesos`}
                  preview={formatPeso(finish.flat)}
                />
                <td className={`${tdLabel} border-l border-rule num text-muted`}>
                  {finish.bindery ? 'Bindery' : 'Press'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

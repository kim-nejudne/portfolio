'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { RegistrationTarget } from '@/components/furniture/marks';
import { formatInteger } from '@forme/domain';
import type { PriceMatrix, ProductId, QuoteFieldError, QuoteInput } from '@forme/domain';

const FIELD =
  'h-8 w-full border border-rule-strong bg-paper px-2 num text-sm transition-colors duration-100 focus:border-ink';
const LEGEND = 'label-caps text-muted';

export function QuoteForm({
  input,
  matrix,
  errors,
  action = '/quote',
  submitLabel,
}: {
  input: QuoteInput;
  matrix: PriceMatrix;
  errors: readonly QuoteFieldError[];
  action?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [product, setProduct] = useState<ProductId>(input.product);
  const [pending, startTransition] = useTransition();
  const pageError = errors.find((error) => error.field === 'pageCount');

  function push() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (typeof value === 'string' && value.length > 0) params.append(key, value);
    }
    startTransition(() => {
      router.replace(`${action}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      onChange={push}
      className="border border-rule-strong"
      data-testid="quote-form"
    >
      <div className="flex items-center justify-between border-b-2 border-rule-strong px-4 py-2">
        <h2 className="label-caps">Specification</h2>
        <span className="flex items-center gap-2">
          {pending ? <RegistrationTarget size={14} spinning /> : null}
          <span className="num text-2xs text-muted">
            {pending ? 'RECALCULATING' : 'PRICED'}
          </span>
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <p className="sm:col-span-2">
          <label htmlFor="product" className={LEGEND}>
            Product
          </label>
          <select
            id="product"
            name="product"
            defaultValue={input.product}
            onChange={(event) => setProduct(event.target.value as ProductId)}
            className={FIELD}
            data-testid="quote-product"
          >
            {matrix.products.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </p>

        <p>
          <label htmlFor="size" className={LEGEND}>
            Finished size
          </label>
          <select id="size" name="size" defaultValue={input.size} className={FIELD} data-testid="quote-size">
            {matrix.sizes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label} — {row.widthMm} × {row.heightMm}mm
              </option>
            ))}
          </select>
        </p>

        <p>
          <label htmlFor="quantity" className={LEGEND}>
            Quantity
          </label>
          <select
            id="quantity"
            name="quantity"
            defaultValue={input.quantity.toString()}
            className={FIELD}
            data-testid="quote-quantity"
          >
            {matrix.quantityBreaks.map((row) => (
              <option key={row.quantity} value={row.quantity.toString()}>
                {formatInteger(row.quantity)}
              </option>
            ))}
          </select>
        </p>

        {product === 'booklets' ? (
          <p className="sm:col-span-2">
            <label htmlFor="pages" className={LEGEND}>
              Page count
            </label>
            <input
              id="pages"
              name="pages"
              type="number"
              min={8}
              max={160}
              step={4}
              defaultValue={(input.pageCount ?? 24).toString()}
              aria-invalid={pageError ? true : undefined}
              aria-describedby="pages-help pages-error"
              className={FIELD}
              data-testid="quote-pages"
            />
            <span id="pages-help" className="mt-1 block text-xs text-muted">
              Multiples of 4 only. A signature is folded from one sheet printed both sides, so 4pp
              is the smallest unit a booklet can be built from.
            </span>
            {pageError ? (
              <span
                id="pages-error"
                className="mt-1 block text-xs text-magenta"
                data-testid="quote-pages-error"
              >
                {pageError.message}
              </span>
            ) : null}
          </p>
        ) : null}

        <p className="sm:col-span-2">
          <label htmlFor="stock" className={LEGEND}>
            Stock
          </label>
          <select id="stock" name="stock" defaultValue={input.stock} className={FIELD} data-testid="quote-stock">
            {matrix.stocks.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label} — {row.coated ? 'coated' : 'uncoated'}, ink limit {row.inkLimit}%
              </option>
            ))}
          </select>
        </p>

        <p>
          <label htmlFor="colours" className={LEGEND}>
            Colours
          </label>
          <select id="colours" name="colours" defaultValue={input.colours} className={FIELD} data-testid="quote-colours">
            {matrix.colours.map((row) => (
              <option key={row.id} value={row.id}>
                {row.id} — {row.label}
              </option>
            ))}
          </select>
        </p>

        <p>
          <label htmlFor="turnaround" className={LEGEND}>
            Turnaround
          </label>
          <select
            id="turnaround"
            name="turnaround"
            defaultValue={input.turnaround}
            className={FIELD}
            data-testid="quote-turnaround"
          >
            {matrix.turnarounds.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label} — {row.id === 'rush' ? '24 hours' : `${row.workingDays} working days`}
              </option>
            ))}
          </select>
        </p>
      </div>

      <fieldset className="border-t border-rule px-4 py-4">
        <legend className={LEGEND}>Finishing</legend>
        <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {matrix.finishing.map((row) => (
            <label key={row.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="finishing"
                value={row.id}
                defaultChecked={input.finishing.includes(row.id)}
                className="size-3.5 accent-cyan"
                data-testid={`quote-finishing-${row.id}`}
              />
              <span>{row.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-4 border-t-2 border-rule-strong px-4 py-3">
        <p className="text-xs text-muted">
          The quote is the URL. Copy it out of the address bar and it opens with these figures.
        </p>
        <button
          type="submit"
          className="border border-ink px-4 py-2 label-caps transition-colors duration-100 hover:bg-ink hover:text-paper"
          data-testid="quote-submit"
        >
          {submitLabel ?? 'Recalculate'}
        </button>
      </div>
    </form>
  );
}

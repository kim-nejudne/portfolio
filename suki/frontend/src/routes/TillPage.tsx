import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAsync } from '../lib/useAsync';
import { listItems } from '../lib/api/items';
import { formatPeso } from '@suki/domain';
import type { Item } from '@suki/domain';
import { MonogramChip } from '../components/MonogramChip';
import { SaleBar } from '../components/SaleBar';
import { useSale } from '../lib/sale';

export function TillPage() {
  const { data: items, loaded } = useAsync(() => listItems(), []);
  const [query, setQuery] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const sale = useSale();
  const location = useLocation();
  const navigate = useNavigate();

  // The cart page leaves by navigating here, so this is the only screen that
  // can tell the shopkeeper the sale landed. Credit sales report themselves —
  // they land on the customer's page with the new balance on it — so only cash
  // needs saying.
  const [receipt, setReceipt] = useState<number | null>(
    () => (location.state as { receipt?: number } | null)?.receipt ?? null,
  );

  // Consume it. Without this the line comes back on every reload, because
  // history state outlives the render that read it.
  useEffect(() => {
    if ((location.state as { receipt?: number } | null)?.receipt != null) {
      navigate('.', { replace: true, state: null });
    }
  }, [location, navigate]);

  const inStock = (items ?? []).filter((i) => i.stock > 0);
  const filtered = query.trim()
    ? inStock.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
    : inStock;

  function addOne(item: Item) {
    // The receipt is about the sale that just finished. Starting the next one
    // is what makes it stale, so that is what dismisses it — no timer, and
    // nothing that disappears while it is being read.
    setReceipt(null);
    sale.add(item);
    setFlash(item.id);
    window.setTimeout(() => setFlash(null), 200);
  }

  return (
    <>
      <div className="rule px-4 pt-4 pb-3" style={{ background: 'var(--color-paper)' }}>
        <h1 className="text-[22px] leading-tight">Till</h1>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items"
          aria-label="Search items"
          className="mt-2 w-full mono text-[15px] px-3"
          style={{
            minHeight: 'var(--tap-min)',
            border: '1px solid var(--color-rule)',
            borderRadius: 'var(--radius-tap)',
            background: 'transparent',
          }}
          data-testid="till-search"
        />
      </div>

      {receipt !== null && (
        <p
          className="rule px-4 py-2 mono text-[13px] anim-fade-in"
          role="status"
          data-testid="till-receipt"
        >
          Sold · {formatPeso(receipt)} · cash in the tin
        </p>
      )}

      <div
        className="px-4 py-3"
        style={{
          // Exact, not estimated. The sale bar is one row of a known height,
          // declared once in `index.css` and cleared here by the same token —
          // which is the difference between this and the 220px that used to be
          // guessed against a tray that could grow to 32dvh plus its chrome.
          paddingBottom:
            sale.lines.length > 0 ? 'calc(var(--sale-bar-height) + var(--space-4))' : 'var(--space-6)',
        }}
      >
        {!loaded ? (
          <p className="text-muted text-[14px]">Reading the shelf…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted text-[14px]">No items match “{query}”.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3" data-testid="till-grid">
            {filtered.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => addOne(it)}
                  className={`w-full text-left ${flash === it.id ? 'anim-bump' : ''}`}
                  style={{
                    minHeight: 96,
                    padding: 12,
                    border: '1px solid var(--color-rule)',
                    borderRadius: 'var(--radius-tap)',
                    background: 'var(--color-paper)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                  data-testid={`till-item-${it.id}`}
                >
                  {/* The monogram sits above the name rather than beside it.
                      Sharing the row cost the name about half the cell, which
                      clamped "Lucky Me Pancit Canton Chilimansi" and
                      "…Canton Original" to the same string — two different
                      products, identical on the screen used a hundred times a
                      day. Full width and three lines separates every name in
                      the catalogue. */}
                  <div className="flex flex-col gap-1.5">
                    <MonogramChip name={it.name} size={32} />
                    <span className="text-[13px] leading-tight line-clamp-3">{it.name}</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-auto">
                    <span className="amount text-[18px]">{formatPeso(it.sellPrice)}</span>
                    <span className="mono text-[11px] text-muted">{it.stock} left</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {sale.lines.length > 0 && <SaleBar count={sale.count} total={sale.total} />}
    </>
  );
}

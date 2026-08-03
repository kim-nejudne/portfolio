import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAsync } from '../lib/useAsync';
import { changeBuyPrice, getItem } from '../lib/api/items';
import { listMovements, recordStockAdjustment } from '../lib/api/stock';
import { formatPeso, formatPesoBare, parsePesoInput, PESO_SIGN } from '@suki/domain';
import { MonogramChip } from '../components/MonogramChip';
import { BigButton } from '../components/BigButton';
import { shortDate } from '@suki/domain';
import { useQueue } from '../lib/useQueue';

export function ItemPage() {
  const { itemId = '' } = useParams();
  useQueue();
  const navigate = useNavigate();
  const { data: item, loaded } = useAsync(() => getItem(itemId), [itemId]);
  const { data: movements } = useAsync(() => listMovements(itemId), [itemId]);

  const [buyPriceRaw, setBuyPriceRaw] = useState<string>('');
  useEffect(() => {
    if (item) setBuyPriceRaw(String(item.buyPrice));
  }, [item?.buyPrice, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [addOpen, setAddOpen] = useState(false);

  const parsedBuy = parsePesoInput(buyPriceRaw);
  const liveBuyPrice = parsedBuy !== null && parsedBuy > 0 ? parsedBuy : item?.buyPrice ?? 0;

  const marginPerPiece = useMemo(() => {
    if (!item) return 0;
    const perPiece = Math.floor(liveBuyPrice / item.perPack);
    return item.sellPrice - perPiece;
  }, [item, liveBuyPrice]);

  const marginPerPack = useMemo(() => {
    if (!item) return 0;
    return item.sellPrice * item.perPack - liveBuyPrice;
  }, [item, liveBuyPrice]);

  if (!loaded || !item) return <p className="px-4 py-6 text-muted">Looking up the item…</p>;

  const changed = parsedBuy !== null && parsedBuy > 0 && parsedBuy !== item.buyPrice;

  function commitBuyPrice() {
    if (parsedBuy === null || parsedBuy <= 0 || !item || parsedBuy === item.buyPrice) return;
    changeBuyPrice(item.id, parsedBuy);
  }

  return (
    <>
      <header className="rule px-4 pt-4 pb-3">
        <button type="button" onClick={() => navigate('/stock')}
          className="mono text-[12px] uppercase text-muted inline-flex items-center gap-1"
          style={{ minHeight: 'var(--tap-min)' }}>
          <span aria-hidden>←</span> Stock
        </button>
        <div className="flex items-start gap-3 mt-1">
          <MonogramChip name={item.name} size={48} />
          <div className="min-w-0">
            <h1 className="text-[22px] leading-tight" style={{ wordBreak: 'break-word' }}>{item.name}</h1>
            <p className="mono text-[11px] text-muted mt-1">stock {item.stock} {item.sellUnit}{item.stock === 1 ? '' : 's'}</p>
          </div>
        </div>
      </header>

      <section className="rule px-4 py-4">
        <p className="mono uppercase text-[11px] text-muted mb-2">Tingi</p>
        <dl className="grid grid-cols-[1fr_auto] gap-y-2 gap-x-4">
          <dt className="text-[14px]">Buy · 1 {item.buyUnit}</dt>
          <dd className="amount mono text-[18px]">
            <label className="sr-only" htmlFor="buy-price">Buy price</label>
            <span className="inline-flex items-baseline gap-1">
              <span aria-hidden>{PESO_SIGN}</span>
              <input
                id="buy-price"
                inputMode="numeric"
                pattern="[0-9]*"
                value={buyPriceRaw}
                onChange={(e) => setBuyPriceRaw(e.target.value)}
                className="amount mono text-[18px] text-right"
                style={{ width: 90, borderBottom: '1px dashed var(--color-rule)' }}
                data-testid="item-buy-price"
              />
            </span>
          </dd>

          <dt className="text-[14px]">Sell · 1 {item.sellUnit}</dt>
          <dd className="amount text-[18px]">{formatPeso(item.sellPrice)}</dd>

          <dt className="text-[14px]">Conversion</dt>
          <dd className="mono text-[15px]">{item.perPack} {item.sellUnit}s per {item.buyUnit}</dd>

          <dt className="text-[14px] rule pt-3">Margin per piece</dt>
          <dd className="amount text-[18px] rule pt-3" style={{ color: marginPerPiece < 0 ? 'var(--color-utang)' : 'var(--color-bayad)' }}>
            {formatPeso(marginPerPiece)}
          </dd>

          <dt className="text-[14px]">Margin per pack</dt>
          <dd className="amount text-[18px]" style={{ color: marginPerPack < 0 ? 'var(--color-utang)' : 'var(--color-bayad)' }}>
            {formatPeso(marginPerPack)}
          </dd>
        </dl>

        {changed && (
          <div className="mt-3 flex items-center gap-2">
            <BigButton variant="ink" onClick={commitBuyPrice} style={{ flex: 1 }} data-testid="item-save-buy-price">
              Save new buy price
            </BigButton>
            <BigButton variant="outline" onClick={() => setBuyPriceRaw(String(item.buyPrice))} style={{ flex: 1 }}>
              Cancel
            </BigButton>
          </div>
        )}
      </section>

      <section className="rule px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="mono uppercase text-[11px] text-muted">Stock movements</p>
            <p className="text-[13px] text-muted">Deliveries in, sales out, and hand-recorded adjustments.</p>
          </div>
          <button type="button" onClick={() => setAddOpen(true)}
            className="mono uppercase text-[12px] px-3"
            style={{ minHeight: 'var(--tap-min)', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-tap)' }}
            data-testid="item-add-movement">
            Record
          </button>
        </div>
        <ul>
          {(movements ?? []).map((m) => (
            <li key={m.id} className="rule py-2 flex items-center gap-3">
              <span className="mono text-[12px] text-muted w-16">{shortDate(m.createdAt)}</span>
              <span className="text-[14px] flex-1 capitalize">{m.kind}{m.note ? ` — ${m.note}` : ''}</span>
              <span className="amount text-[15px]"
                style={{ color: m.kind === 'delivery' ? 'var(--color-bayad)' : m.kind === 'spoilage' ? 'var(--color-utang)' : 'var(--color-ink)' }}>
                {m.kind === 'delivery' ? '+' : '−'}{formatPesoBare(m.qty)}
              </span>
            </li>
          ))}
          {(movements ?? []).length === 0 && (
            <li className="py-3 text-muted text-[14px]">No movements yet.</li>
          )}
        </ul>
      </section>

      <div style={{ height: 24 }} />

      {addOpen && (
        <MovementSheet
          onClose={() => setAddOpen(false)}
          onSubmit={(kind, qty, note) => {
            recordStockAdjustment({ itemId: item.id, kind, qty, ...(note ? { note } : {}) });
            setAddOpen(false);
          }}
        />
      )}
    </>
  );
}

type MvKind = 'delivery' | 'spoilage' | 'adjustment';

function MovementSheet({ onClose, onSubmit }: { onClose: () => void; onSubmit: (k: MvKind, qty: number, note?: string) => void }) {
  const [kind, setKind] = useState<MvKind>('delivery');
  const [qtyRaw, setQtyRaw] = useState('');
  const [note, setNote] = useState('');
  const qty = parsePesoInput(qtyRaw);
  const invalid = qty === null || qty <= 0;

  return (
    <div role="dialog" aria-modal="true" aria-label="Record stock movement"
      className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(28,42,58,0.28)' }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}
        className="w-full anim-slide-in px-4 pt-4 pb-6" style={{ background: 'var(--color-paper)' }}
      >
        <div className="flex items-center justify-between rule pb-3 mb-3">
          <h2 className="text-[18px]">Record movement</h2>
          <button type="button" className="mono text-[13px] uppercase" onClick={onClose}
            style={{ minHeight: 'var(--tap-min)', minWidth: 'var(--tap-min)' }}>Cancel</button>
        </div>
        <fieldset className="mb-3">
          <legend className="mono uppercase text-[11px] text-muted mb-2">Type</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['delivery', 'spoilage', 'adjustment'] as MvKind[]).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className="mono text-[13px] capitalize"
                style={{ minHeight: 'var(--tap-min)', border: '1px solid var(--color-rule)',
                  background: kind === k ? 'var(--color-ink)' : 'transparent',
                  color: kind === k ? 'var(--color-paper)' : 'var(--color-ink)',
                  borderRadius: 'var(--radius-tap)' }}>{k}</button>
            ))}
          </div>
        </fieldset>
        <label htmlFor="mv-qty" className="block mono uppercase text-[11px] text-muted">Quantity (sell units)</label>
        <input id="mv-qty" inputMode="numeric" pattern="[0-9]*" value={qtyRaw}
          onChange={(e) => setQtyRaw(e.target.value)}
          className="amount text-[24px] w-full"
          style={{ minHeight: 'var(--tap-min)', borderBottom: '1px solid var(--color-rule)' }}
          aria-invalid={invalid}
        />
        <label htmlFor="mv-note" className="block mono uppercase text-[11px] text-muted mt-3">Note (optional)</label>
        <input id="mv-note" value={note} onChange={(e) => setNote(e.target.value)}
          className="w-full text-[15px] px-2"
          style={{ minHeight: 'var(--tap-min)', borderBottom: '1px solid var(--color-rule)' }}
        />
        <div className="mt-4">
          <BigButton variant="ink" disabled={invalid}
            onClick={() => { if (qty !== null && qty > 0) onSubmit(kind, qty, note.trim() || undefined); }}
            style={{ width: '100%' }}>
            Record
          </BigButton>
        </div>
      </div>
    </div>
  );
}

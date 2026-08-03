import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAsync } from '../lib/useAsync';
import { listItems } from '../lib/api/items';
import { formatPeso } from '../lib/money';
import { MonogramChip } from '../components/MonogramChip';
import type { Item } from '../lib/types';

type Filter = 'all' | 'low' | 'out';

export function StockPage() {
  const { data: items, loaded } = useAsync(() => listItems(), []);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (items ?? []).filter((i) => (q ? i.name.toLowerCase().includes(q) : true));
    if (filter === 'low') return list.filter((i) => i.stock > 0 && i.stock <= i.reorderAt);
    if (filter === 'out') return list.filter((i) => i.stock <= 0);
    return list;
  }, [items, query, filter]);

  return (
    <>
      <header className="rule px-4 pt-4 pb-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] leading-tight">Stock</h1>
          <p className="text-[13px] text-muted">What is on the shelf, in sell units.</p>
        </div>
        <NavLink
          to="/restock"
          className="mono uppercase text-[12px] px-3"
          style={{ minHeight: 'var(--tap-min)', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-tap)', display: 'inline-flex', alignItems: 'center' }}
          data-testid="stock-goto-restock"
        >
          Restock list
        </NavLink>
      </header>

      <div className="rule px-4 py-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stock"
          aria-label="Search stock"
          className="w-full mono text-[15px] px-3"
          style={{ minHeight: 'var(--tap-min)', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-tap)' }}
          data-testid="stock-search"
        />
        <div className="flex gap-2 mt-3" role="tablist" aria-label="Filter">
          <FilterTab active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
          <FilterTab active={filter === 'low'} onClick={() => setFilter('low')} label="Running low" />
          <FilterTab active={filter === 'out'} onClick={() => setFilter('out')} label="Out" />
        </div>
      </div>

      {!loaded ? (
        <p className="px-4 py-6 text-muted">Counting the shelf…</p>
      ) : (
        <ul data-testid="stock-list">
          {filtered.map((i) => (
            <StockRow key={i.id} item={i} />
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-muted text-[14px]">Nothing matches.</li>
          )}
        </ul>
      )}
    </>
  );
}

function FilterTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="mono text-[12px] uppercase px-3"
      style={{
        minHeight: 'var(--tap-min)',
        border: '1px solid var(--color-rule)',
        background: active ? 'var(--color-ink)' : 'transparent',
        color: active ? 'var(--color-paper)' : 'var(--color-ink)',
        borderRadius: 'var(--radius-tap)',
      }}
    >
      {label}
    </button>
  );
}

function StockRow({ item }: { item: Item }) {
  const isOut = item.stock <= 0;
  const isLow = !isOut && item.stock <= item.reorderAt;
  return (
    <li className="rule">
      <NavLink
        to={`/stock/${item.id}`}
        className="flex items-center gap-3 px-4 py-3"
        style={{ minHeight: 'var(--tap-min)' }}
        data-testid={`stock-row-${item.id}`}
      >
        <MonogramChip name={item.name} size={40} />
        <div className="flex-1 min-w-0">
          <p
            className="text-[15px] truncate"
            style={{ textDecoration: isOut ? 'line-through' : 'none', color: isOut ? 'var(--color-muted)' : 'var(--color-ink)' }}
          >
            {item.name}
          </p>
          <p className="mono text-[11px] text-muted truncate">
            per {item.sellUnit} · {item.perPack} per {item.buyUnit}
            {isOut && <span aria-hidden> · <span style={{ color: 'var(--color-utang)' }}>OUT</span></span>}
            {isLow && <span aria-hidden> · low</span>}
          </p>
          {isOut && <span className="sr-only">OUT of stock</span>}
          {isLow && <span className="sr-only">running low</span>}
        </div>
        <div className="text-right">
          <p className="amount text-[16px]" style={{ color: isOut ? 'var(--color-muted)' : 'var(--color-ink)' }}>
            {item.stock}
          </p>
          <p className="amount text-[12px] text-muted">{formatPeso(item.sellPrice)}</p>
        </div>
      </NavLink>
    </li>
  );
}

/**
 * The running total, pinned above the tab bar while a sale is open.
 *
 * It replaces the tray that used to unroll over the Till, and it is
 * deliberately **review-only** — it carries no Bayad and no Lista. A sale is
 * money changing hands and it now gets recorded on a screen where every line is
 * visible, rather than from a strip covering the shelf you were reading. That
 * costs one tap on the busiest screen in the app, which is the trade, stated
 * plainly.
 *
 * What it does have to do is show the total large, because saying the number
 * out loud is the moment the whole screen exists for. Ink on paper inverted:
 * the loudest thing on the page, in a colour already in the palette.
 */
import { NavLink } from 'react-router-dom';
import { formatPeso } from '@suki/domain';

interface Props {
  count: number;
  total: number;
}

export function SaleBar({ count, total }: Props) {
  return (
    <NavLink
      to="/cart"
      aria-label={`Review sale — ${count} ${count === 1 ? 'item' : 'items'}, ${formatPeso(total)}`}
      className="sale-bar fixed left-0 right-0 z-30 flex items-center gap-3 px-4 anim-slide-in"
      style={{
        bottom: 'var(--bottom-bar-height)',
        height: 'var(--sale-bar-height)',
        background: 'var(--color-ink)',
        color: 'var(--color-paper)',
      }}
      data-testid="sale-bar"
    >
      <span className="amount text-[26px] leading-none" data-testid="sale-bar-total">
        {formatPeso(total)}
      </span>
      <span className="mono uppercase text-[11px]" style={{ opacity: 0.75 }}>
        {count} {count === 1 ? 'item' : 'items'}
      </span>
      <span className="flex-1" aria-hidden />
      <span className="mono uppercase text-[13px]">
        Review <span aria-hidden>→</span>
      </span>
    </NavLink>
  );
}

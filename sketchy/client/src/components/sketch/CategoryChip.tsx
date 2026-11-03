import type { CSSProperties } from 'react';
import type { TurnCategoryView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';

/**
 * The current word's category (UI by role and phase): "🍔 Food", or "Custom" for one of the room's
 * own words, as a small pill with a pen border, at the caller's type size. One line; a long title
 * truncates, so the chip never widens its row or pushes the blanks beside it.
 */
export function CategoryChip({
  category,
  t,
  className = '',
  style,
}: {
  category: TurnCategoryView;
  t: Translate;
  className?: string;
  style?: CSSProperties;
}) {
  const name = category.kind === 'custom' ? t('categoryCustom') : category.title;
  return (
    <span
      data-category-chip
      style={style}
      className={`inline-flex max-w-full min-w-0 items-center gap-[0.3em] rounded-full border-[1.5px] border-pen bg-paper px-[0.55em] py-[0.15em] leading-tight whitespace-nowrap text-ink ${className}`}
    >
      <span className="sr-only">{t('categoryLabel', { name })}</span>
      {category.kind === 'category' && (
        <span aria-hidden="true" className="shrink-0">
          {category.emoji}
        </span>
      )}
      <span aria-hidden="true" className="min-w-0 truncate">
        {name}
      </span>
    </span>
  );
}

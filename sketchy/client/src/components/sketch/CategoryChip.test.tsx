// The current word's category chip (F79): "🍔 Food", or "Custom" for a room's own word, on one line.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { t } from '../../lib/copy.js';
import { CategoryChip } from './CategoryChip.js';

const text = (html: string) => html.replace(/<[^>]+>/g, '');

describe('<CategoryChip>', () => {
  it('shows the emoji and title, and says "Category: Food" to screen readers', () => {
    const html = renderToStaticMarkup(
      <CategoryChip category={{ kind: 'category', title: 'Food', emoji: '🍔' }} t={t} />,
    );
    expect(html).toContain('<span class="sr-only">Category: Food</span>');
    expect(html).toContain('<span aria-hidden="true" class="shrink-0">🍔</span>');
    expect(html).toContain('>Food</span>');
  });

  it('shows "Custom" with no emoji for one of the room’s own words', () => {
    const html = renderToStaticMarkup(<CategoryChip category={{ kind: 'custom' }} t={t} />);
    expect(text(html)).toBe('Category: CustomCustom');
    expect(html).not.toContain('shrink-0');
  });

  it('stays on one line and truncates a long title rather than growing', () => {
    const html = renderToStaticMarkup(
      <CategoryChip
        category={{
          kind: 'category',
          title: 'Things you find at the bottom of a bag',
          emoji: '👜',
        }}
        t={t}
      />,
    );
    const chip = html.match(/<span data-category-chip[^>]* class="([^"]*)"/)![1]!.split(' ');
    expect(chip).toEqual(expect.arrayContaining(['whitespace-nowrap', 'max-w-full', 'min-w-0']));
    expect(html).toMatch(/class="min-w-0 truncate">Things you find/);
  });
});

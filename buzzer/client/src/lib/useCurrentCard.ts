import { useEffect, useState } from 'react';

/** The DOM id of question `id`'s card, which the outline and the toolbar jump to. */
export const cardDomId = (id: string) => `card-${id}`;

/**
 * The question whose card is in view (EDT-02): the first, in list order, that crosses the band
 * from under the sticky toolbar to the middle of the window. It keeps the last answer while no
 * card crosses the band, and is null until one has, or where there is no IntersectionObserver.
 */
export function useCurrentCard(ids: readonly string[], topOffset = 96): string | null {
  const [current, setCurrent] = useState<string | null>(null);
  // The list's identity changes on every edit; its order is what matters.
  const key = ids.join(' ');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || key === '') return;
    const order = key.split(' ');
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id.slice('card-'.length);
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const first = order.find((id) => visible.has(id));
        if (first !== undefined) setCurrent(first);
      },
      { rootMargin: `-${topOffset}px 0px -50% 0px` },
    );
    for (const id of order) {
      const card = document.getElementById(cardDomId(id));
      if (card) observer.observe(card);
    }
    return () => observer.disconnect();
  }, [key, topOffset]);

  return current;
}

import type { ReactNode } from 'react';

type Option = { id: string; label: string };

// Only options: make the props and the component generic over the item type.
export type ListProps = {
  items: readonly Option[];
  render: (item: Option) => ReactNode;
  onSelect?: (item: Option) => void;
};

export function List({ items, render, onSelect }: ListProps) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} onClick={() => onSelect?.(item)}>
          {render(item)}
        </li>
      ))}
    </ul>
  );
}

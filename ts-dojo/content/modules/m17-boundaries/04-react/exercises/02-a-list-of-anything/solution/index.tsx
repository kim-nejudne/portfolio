import type { ReactNode } from 'react';

export type ListProps<T> = {
  items: readonly T[];
  render: (item: T) => ReactNode;
  onSelect?: (item: T) => void;
};

export function List<T extends { id: string }>({
  items,
  render,
  onSelect,
}: ListProps<T>) {
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

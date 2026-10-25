import type { ComponentProps, ReactNode } from 'react';
import type { Equal, Expect } from '@dojo/type-utils';
import { List } from './index';

// Flattens an intersection, so the props may be written as one object type or several.
type Flat<T> = { [K in keyof T]: T[K] };

type User = { id: string; name: string };
type Product = { id: string; price: number };

declare const users: User[];

type cases = [
  Expect<
    Equal<
      Flat<ComponentProps<typeof List<User>>>,
      {
        items: readonly User[];
        render: (item: User) => ReactNode;
        onSelect?: (item: User) => void;
      }
    >
  >, // List<User>
  Expect<
    Equal<
      Flat<ComponentProps<typeof List<Product>>>,
      {
        items: readonly Product[];
        render: (item: Product) => ReactNode;
        onSelect?: (item: Product) => void;
      }
    >
  >, // List<Product>
];

// @ts-expect-error
const noId = () => List({ items: [1, 2, 3], render: (n) => n }); // items need an id

// @ts-expect-error
const price = () => List({ items: users, render: (u) => u.price }); // render gets a User

// @ts-expect-error
type Named = ComponentProps<typeof List<{ name: string }>>; // no id, no List

export { noId, price };
export type { Named };

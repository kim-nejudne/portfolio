import type { Equal, Expect } from '@dojo/type-utils';
import { Repository, type Result } from './index';

type User = { id: string; name: string };
type Product = { id: string; price: number };

const users = new Repository<User>();
const products = Repository.from<Product>([
  { id: 'p1', price: 3 },
  { id: 'p2', price: 5 },
]);
const inferred = Repository.from([{ id: 'c1', color: 'red' }]);
const found = users.get('u1');
const names = users.map((user) => user.name);
const prices = products.map((product) => product.price > 4);

type cases = [
  Expect<Equal<typeof found, Result<User>>>, // get returns a Result of the item type
  Expect<Equal<Parameters<typeof users.add>, [item: User]>>, // add takes the item type
  Expect<Equal<typeof names, string[]>>, // map returns what the callback returns
  Expect<Equal<typeof prices, boolean[]>>, // whatever that is
  Expect<Equal<typeof products, Repository<Product>>>, // from takes a type argument of its own
  Expect<Equal<typeof inferred, Repository<{ id: string; color: string }>>>, // or infers it from the items
];

// @ts-expect-error
users.add({ id: 'u1' }); // a User needs a name

// @ts-expect-error
users.add({ id: 7, name: 'Ada' }); // ids are strings

// @ts-expect-error
products.add({ id: 'p3', name: 'Lamp' }); // each repository keeps its own item type

// @ts-expect-error
new Repository<{ name: string }>(); // only items with a string id

// @ts-expect-error
Repository.from([{ name: 'Ada' }]); // from too

test('an empty repository', () => {
  const empty = new Repository<User>();
  expect(empty.size()).toBe(0);
  expect(empty.map((user) => user.name)).toEqual([]);
  expect(empty.get('u1')).toEqual({ ok: false, error: 'No item with id u1.' });
});

test('get finds every item it was given, and nothing else', () => {
  const repository = new Repository<User>();
  const added: User[] = [];
  for (let i = 0; i < 12; i++) {
    const user = { id: `u${i * 3}`, name: `User ${i}` };
    added.push(user);
    repository.add(user);
    expect(repository.size()).toBe(i + 1);
  }
  for (const user of added) {
    const result = repository.get(user.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(user);
    }
  }
  for (let i = 0; i < 12; i++) {
    const id = `u${i * 3 + 1}`;
    expect(repository.get(id)).toEqual({
      ok: false,
      error: `No item with id ${id}.`,
    });
  }
});

test('map keeps the order, and a replaced item keeps its place', () => {
  const repository = Repository.from([
    { id: 'a', name: 'Ada' },
    { id: 'b', name: 'Grace' },
    { id: 'c', name: 'Linus' },
  ]);
  repository.add({ id: 'a', name: 'Ada Lovelace' });
  repository.add({ id: 'd', name: 'Barbara' });
  expect(repository.size()).toBe(4);
  expect(repository.map((user) => user.name)).toEqual([
    'Ada Lovelace',
    'Grace',
    'Linus',
    'Barbara',
  ]);
  expect(repository.map((user) => user.id.toUpperCase())).toEqual([
    'A',
    'B',
    'C',
    'D',
  ]);
});

test('from copies the items, and repositories are independent', () => {
  for (let count = 0; count <= 5; count++) {
    const list = Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      price: i * 2,
    }));
    const first = Repository.from(list);
    const second = Repository.from(list);
    list.push({ id: 'late', price: 99 });
    first.add({ id: 'extra', price: 1 });
    expect(first.size()).toBe(count + 1);
    expect(second.size()).toBe(count);
    expect(second.map((product) => product.price)).toEqual(
      Array.from({ length: count }, (_, i) => i * 2),
    );
    expect(second.get('late').ok).toBe(false);
  }
});

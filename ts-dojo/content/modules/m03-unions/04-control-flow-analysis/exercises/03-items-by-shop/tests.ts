import { itemsByShop } from './index';

/** Every label, asked for after itemsByShop has returned, as the UI does. */
function labels(lines: readonly string[]): string[] {
  return itemsByShop(lines).map((entry) => entry.label());
}

test('each label names the shop above its item', () => {
  expect(labels(['# bakery', 'bread, rolls', '# market', 'apples'])).toEqual([
    'BAKERY: bread',
    'BAKERY: rolls',
    'MARKET: apples',
  ]);
});

test('three shops keep their own labels', () => {
  const list = ['# dairy', 'milk', '# bakery', 'bread', '# market', 'plums'];
  expect(labels(list)).toEqual([
    'DAIRY: milk',
    'BAKERY: bread',
    'MARKET: plums',
  ]);
});

test('each entry keeps its item', () => {
  const entries = itemsByShop(['# market', 'apples', 'pears,plums']);
  expect(entries.map((entry) => entry.item)).toEqual([
    'apples',
    'pears',
    'plums',
  ]);
});

test('items before the first shop are skipped', () => {
  expect(labels(['milk', '# dairy', 'cheese'])).toEqual(['DAIRY: cheese']);
});

test('a shop name is trimmed', () => {
  expect(labels(['# corner shop ', 'stamps'])).toEqual(['CORNER SHOP: stamps']);
});

test('an empty list has no entries', () => {
  expect(itemsByShop([])).toHaveLength(0);
});

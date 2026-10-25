import { findItem, formatCents, menu, MenuItem } from './menu';

// The price tag of one item on the menu: priceTag('Espresso') is 'Espresso €3.00'.
export function priceTag(name: string) {
  const item = findItem(name);
  return `${item.name} ${formatCents(item)}`;
}

// The total of an order, in cents.
export function orderTotal(items: MenuItem[]) {
  let total = 0;
  for (const item of items) {
    total += item.price;
  }
  return total;
}

// The receipt: a price tag per item, then the total.
export function receipt(names: string[]) {
  const items = names.map((name) => findItem(name));
  const lines = items.map((item) => priceTag(item));
  lines.push(`Total ${formatCents(orderTotal(items))}`);
  return lines.join('\n');
}

console.log(receipt(menu.map((item) => item.name)));

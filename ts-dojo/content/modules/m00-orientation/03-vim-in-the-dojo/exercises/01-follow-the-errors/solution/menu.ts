// The café's menu. This file is right as it is: read it, don't change it.
export interface MenuItem {
  name: string;
  priceCents: number;
}

export const menu: MenuItem[] = [
  { name: 'Espresso', priceCents: 300 },
  { name: 'Flat white', priceCents: 450 },
  { name: 'Croissant', priceCents: 275 },
];

/** Formats a price in cents as euros: 450 becomes "€4.50". */
export function formatCents(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

/** The item with this name. Throws for a name the menu doesn't have. */
export function findItem(name: string) {
  for (const item of menu) {
    if (item.name === name) return item;
  }
  throw new Error(`${name} is not on the menu`);
}

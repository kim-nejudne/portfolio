/** One item of the list, with a label the UI asks for when it draws the item. */
export type Entry = { item: string; label: () => string };

/**
 * A shopping list, one line at a time: '# bakery' names a shop, and the lines after it list
 * that shop's items, separated by commas. Returns one entry per item; its label is the shop in
 * capitals and the item, such as 'BAKERY: bread'. Items before the first shop are skipped.
 */
export function itemsByShop(lines: readonly string[]): Entry[] {
  const entries: Entry[] = [];
  let shop: string | undefined;
  for (const line of lines) {
    if (line.startsWith('# ')) {
      shop = line.slice(2).trim();
    } else if (shop !== undefined) {
      // here shop is a string; a const keeps this turn's shop for every label made below
      const name = shop.toUpperCase();
      for (const part of line.split(',')) {
        const item = part.trim();
        entries.push({ item, label: () => `${name}: ${item}` });
      }
    }
  }
  return entries;
}

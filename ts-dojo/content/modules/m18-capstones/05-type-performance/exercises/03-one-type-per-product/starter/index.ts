type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type Sku = `${'A' | 'B'}${Digit}${Digit}${Digit}`;

// One object type for each of the 2,000 SKUs, each tying its sku to itself.
type ToProduct<K> = K extends string ? { sku: K; price: number } : never;
export type Product = ToProduct<Sku>;

export type CartLine = Product & { quantity: number };

export function line(product: Product, quantity: number): CartLine {
  return { ...product, quantity };
}

export function total(lines: readonly CartLine[]): number {
  return lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

const pen: Product = { sku: 'A001', price: 2.5 };
const ink: Product = { sku: 'B042', price: 7 };

export const sample = [line(pen, 4), line(ink, 1)];

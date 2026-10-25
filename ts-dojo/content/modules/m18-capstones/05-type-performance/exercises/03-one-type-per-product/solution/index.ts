type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type Sku = `${'A' | 'B'}${Digit}${Digit}${Digit}`;

// One object type whose sku is the union: the same values, one type.
export interface Product {
  sku: Sku;
  price: number;
}

// An interface that extends Product, not an intersection.
export interface CartLine extends Product {
  quantity: number;
}

export function line(product: Product, quantity: number): CartLine {
  return { ...product, quantity };
}

export function total(lines: readonly CartLine[]): number {
  return lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

const pen: Product = { sku: 'A001', price: 2.5 };
const ink: Product = { sku: 'B042', price: 7 };

export const sample = [line(pen, 4), line(ink, 1)];

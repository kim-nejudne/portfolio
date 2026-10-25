import type { Equal, Expect } from '@dojo/type-utils';
import {
  line,
  sample,
  total,
  type CartLine,
  type Product,
  type Sku,
} from './index';

type cases = [
  Expect<Equal<Product, { sku: Sku; price: number }>>, // one object type
  Expect<Equal<CartLine, { sku: Sku; price: number; quantity: number }>>, // one flat object type
  Expect<Equal<(typeof sample)[number], CartLine>>, // the sample is a list of cart lines
];

// @ts-expect-error
const unknownSku: Product = { sku: 'C001', price: 1 }; // only A and B SKUs exist

test('total adds price times quantity', () => {
  expect(total(sample)).toBe(17);
  expect(total([])).toBe(0);
});

test('line copies the product and adds the quantity', () => {
  const item = line({ sku: 'A123', price: 3 }, 5);
  expect(item).toEqual({ sku: 'A123', price: 3, quantity: 5 });
  expect(total([item, line({ sku: 'B999', price: 0.5 }, 2)])).toBe(16);
});

export { unknownSku };

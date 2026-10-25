import { orderTotal, priceTag, receipt } from './index';
import { formatCents, menu } from './menu';

test('tags an espresso', () => {
  expect(priceTag('Espresso')).toBe('Espresso €3.00');
});

test('tags a croissant', () => {
  expect(priceTag('Croissant')).toBe('Croissant €2.75');
});

test('totals the whole menu in cents', () => {
  expect(orderTotal(menu)).toBe(1025);
});

test('totals items that are not on the menu', () => {
  const tea = { name: 'Tea', priceCents: 250 };
  expect(orderTotal([tea, tea])).toBe(500);
});

test('prints a receipt', () => {
  expect(receipt(['Espresso', 'Flat white'])).toBe(
    'Espresso €3.00\nFlat white €4.50\nTotal €7.50',
  );
});

test('formats cents as euros', () => {
  expect(formatCents(1025)).toBe('€10.25');
});

import { calls, Cart, traced } from './index';

class Thermometer {
  constructor(private readonly offset: number) {}

  @traced
  convert(celsius: number, unit: 'F' | 'K'): string {
    const value =
      unit === 'F' ? celsius * 1.8 + 32 + this.offset : celsius + 273.15;
    return `${value} ${unit}`;
  }
}

test('add and total still work', () => {
  const cart = new Cart();
  expect(cart.add(3, 2)).toBe(1);
  expect(cart.add(5, 1)).toBe(2);
  expect(cart.total()).toBe(11);
});

test('each call is recorded with its arguments', () => {
  calls.length = 0;
  const cart = new Cart();
  cart.add(4, 3);
  cart.total();
  cart.add(1, 7);
  expect(calls).toEqual(['add(4, 3)', 'total()', 'add(1, 7)']);
});

test('this is the instance the method was called on', () => {
  calls.length = 0;
  const first = new Cart();
  const second = new Cart();
  first.add(10, 1);
  second.add(2, 2);
  second.add(1, 1);
  expect(first.total()).toBe(10);
  expect(second.total()).toBe(5);
  expect(calls).toHaveLength(5);
});

test('traced works on a method of another class', () => {
  calls.length = 0;
  expect(new Thermometer(0).convert(100, 'F')).toBe('212 F');
  expect(new Thermometer(1).convert(10, 'F')).toBe('51 F');
  expect(calls).toEqual(['convert(100, F)', 'convert(10, F)']);
});

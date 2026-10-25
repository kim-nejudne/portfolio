import type { Equal, Expect } from '@dojo/type-utils';
import { isReading, toCelsius, type Reading } from './index';

type cases = [
  Expect<Equal<typeof isReading, (value: unknown) => value is Reading>>, // isReading is a guard on unknown
  Expect<Equal<ReturnType<typeof toCelsius>, number | undefined>>, // toCelsius may give undefined
];

test('isReading accepts readings in both units', () => {
  expect(isReading({ sensor: 'kitchen', unit: 'C', value: 21.5 })).toBe(true);
  expect(isReading({ sensor: 'porch', unit: 'F', value: -4 })).toBe(true);
  expect(isReading({ sensor: '', unit: 'C', value: 0 })).toBe(true);
});

test('isReading accepts a reading with extra properties', () => {
  expect(
    isReading({ sensor: 'attic', unit: 'F', value: 90, battery: 0.8 }),
  ).toBe(true);
});

test('isReading rejects values that are not objects', () => {
  for (const value of [null, undefined, 0, 21.5, 'kitchen', true, [1, 2]]) {
    expect(isReading(value)).toBe(false);
  }
});

test('isReading rejects an object with a property missing', () => {
  expect(isReading({})).toBe(false);
  expect(isReading({ unit: 'C', value: 20 })).toBe(false);
  expect(isReading({ sensor: 'kitchen', value: 20 })).toBe(false);
  expect(isReading({ sensor: 'kitchen', unit: 'C' })).toBe(false);
});

test('isReading rejects an object with a property of the wrong type', () => {
  expect(isReading({ sensor: 7, unit: 'C', value: 20 })).toBe(false);
  expect(isReading({ sensor: 'kitchen', unit: 'K', value: 20 })).toBe(false);
  expect(isReading({ sensor: 'kitchen', unit: 'c', value: 20 })).toBe(false);
  expect(isReading({ sensor: 'kitchen', unit: 'C', value: '20' })).toBe(false);
  expect(isReading({ sensor: 'kitchen', unit: 'F', value: null })).toBe(false);
});

test('toCelsius keeps a Celsius value', () => {
  for (let value = -10; value <= 40; value += 5) {
    expect(toCelsius(JSON.stringify({ sensor: 'a', unit: 'C', value }))).toBe(
      value,
    );
  }
});

test('toCelsius converts a Fahrenheit value', () => {
  expect(toCelsius('{"sensor":"porch","unit":"F","value":212}')).toBeCloseTo(
    100,
  );
  for (let value = -40; value <= 120; value += 8) {
    expect(
      toCelsius(JSON.stringify({ sensor: 'b', unit: 'F', value })),
    ).toBeCloseTo(((value - 32) * 5) / 9);
  }
});

test('toCelsius gives undefined for data that is not a reading', () => {
  expect(toCelsius('null')).toBeUndefined();
  expect(toCelsius('[21]')).toBeUndefined();
  expect(toCelsius('21')).toBeUndefined();
  expect(toCelsius('{"sensor":"a","unit":"K","value":300}')).toBeUndefined();
  expect(toCelsius('{"sensor":"a","unit":"C","value":"21"}')).toBeUndefined();
});

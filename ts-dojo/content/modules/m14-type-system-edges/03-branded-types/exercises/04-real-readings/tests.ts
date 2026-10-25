import type {
  Equal,
  Expect,
  ExpectExtends,
  ExpectFalse,
} from '@dojo/type-utils';
import { Celsius, Fahrenheit, isFreezing, toCelsius } from './index';

// ExpectExtends<To, From> is true when a From is assignable to a To.
type cases = [
  ExpectFalse<ExpectExtends<Celsius, Fahrenheit>>, // a Fahrenheit is no Celsius
  ExpectFalse<ExpectExtends<Fahrenheit, Celsius>>, // a Celsius is no Fahrenheit
  ExpectFalse<ExpectExtends<Celsius, { readonly degrees: number }>>, // nor is a plain object
  Expect<Equal<Celsius['degrees'], number>>, // degrees stays a number
];

// @ts-expect-error
const wrongScale = () => isFreezing(new Fahrenheit(23)); // a Fahrenheit reading

// @ts-expect-error
const plainObject = () => isFreezing({ degrees: -5 }); // a plain object

export { wrongScale, plainObject };

test('is accepts what the constructor made', () => {
  expect(Celsius.is(new Celsius(-5))).toBe(true);
  expect(Celsius.is(new Celsius(0))).toBe(true);
});

test('is rejects other values without throwing', () => {
  expect(Celsius.is(new Fahrenheit(23))).toBe(false);
  expect(Celsius.is({ degrees: -5 })).toBe(false);
  expect(Celsius.is(null)).toBe(false);
  expect(Celsius.is(undefined)).toBe(false);
  expect(Celsius.is(-5)).toBe(false);
  expect(Celsius.is('-5')).toBe(false);
});

test('is rejects copies and fakes', () => {
  const reading = new Celsius(-5);
  const json: unknown = JSON.parse(JSON.stringify(reading));
  const fake: unknown = Object.create(Celsius.prototype);
  const clone: unknown = Object.assign(
    Object.create(Celsius.prototype),
    reading,
  );
  expect(Celsius.is(json)).toBe(false);
  expect(Celsius.is({ ...reading })).toBe(false);
  expect(Celsius.is(fake)).toBe(false);
  expect(Celsius.is(clone)).toBe(false);
});

test('toCelsius returns a Celsius as it is', () => {
  const reading = new Celsius(12);
  expect(toCelsius(reading)).toBe(reading);
});

test('toCelsius converts a Fahrenheit', () => {
  const boiling = toCelsius(new Fahrenheit(212));
  expect(boiling).toBeInstanceOf(Celsius);
  expect(boiling.degrees).toBeCloseTo(100);
  expect(toCelsius(new Fahrenheit(23)).degrees).toBeCloseTo(-5);
  expect(toCelsius(new Fahrenheit(-40)).degrees).toBeCloseTo(-40);
});

test('isFreezing reads a Celsius', () => {
  expect(isFreezing(new Celsius(-5))).toBe(true);
  expect(isFreezing(new Celsius(0))).toBe(true);
  expect(isFreezing(toCelsius(new Fahrenheit(50)))).toBe(false);
});

import type { Alike, Equal, Expect } from '@dojo/type-utils';
import type { Celsius, Fahrenheit, Reading } from './index';

type cases = [
  Expect<Alike<Celsius, { unit: 'C'; value: number }>>, // a Celsius reading is marked 'C'
  Expect<Alike<Fahrenheit, { unit: 'F'; value: number }>>, // a Fahrenheit reading is marked 'F'
  Expect<Equal<Reading, Celsius | Fahrenheit>>, // a reading is either one
];

declare const boiling: Celsius;
declare const bodyHeat: Fahrenheit;

// @ts-expect-error a Celsius reading is not a Fahrenheit one
const asFahrenheit: Fahrenheit = boiling; // Celsius is not Fahrenheit

// @ts-expect-error a Fahrenheit reading is not a Celsius one
const asCelsius: Celsius = bodyHeat; // Fahrenheit is not Celsius

// @ts-expect-error a Celsius reading has no label
const labelled: Reading = { unit: 'C', value: 21, label: 'room' }; // no stray property

export { asFahrenheit, asCelsius, labelled };

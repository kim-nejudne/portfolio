import type { Equal, Expect } from '@dojo/type-utils';
import type {
  FormatOptions,
  UNITS,
  Unit,
  formatBytes,
  parseBytes,
} from './units';

type cases = [
  Expect<Equal<Unit, 'B' | 'kB' | 'MB' | 'GB'>>, // the four units
  Expect<Equal<typeof UNITS, readonly Unit[]>>, // UNITS is a read-only list of units
  Expect<Equal<FormatOptions, { digits?: number; unit?: Unit }>>, // the two options
  Expect<
    Equal<
      Parameters<typeof formatBytes>,
      [bytes: number, options?: FormatOptions]
    >
  >, // formatBytes takes a number and optional options
  Expect<Equal<ReturnType<typeof formatBytes>, string>>, // formatBytes returns a string
  Expect<Equal<Parameters<typeof parseBytes>, [text: string]>>, // parseBytes takes a text
  Expect<Equal<ReturnType<typeof parseBytes>, number | null>>, // parseBytes may find no size
];

// The tests declare values of the declared types: nothing here runs.
declare const units: typeof UNITS;
declare const format: typeof formatBytes;
declare const parse: typeof parseBytes;

// @ts-expect-error
format('1200'); // the size is a number

// @ts-expect-error
format(1200, { unit: 'TB' }); // there is no TB

// @ts-expect-error
format(1200, { digit: 2 }); // the option is called digits

// @ts-expect-error
units.push('TB'); // the list is read-only

// @ts-expect-error
const size: number = parse('1.5 kB'); // the text may not be a size

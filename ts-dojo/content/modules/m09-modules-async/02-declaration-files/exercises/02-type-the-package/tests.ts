import type { Equal, Expect } from '@dojo/type-utils';
import type { SlugOptions, Slugger, slugify, version } from 'tiny-slug';

type cases = [
  Expect<Equal<SlugOptions, { separator?: string; lowercase?: boolean }>>, // the two options
  Expect<
    Equal<Parameters<typeof slugify>, [text: string, options?: SlugOptions]>
  >, // slugify takes a text and optional options
  Expect<Equal<ReturnType<typeof slugify>, string>>, // slugify returns a string
  Expect<Equal<ConstructorParameters<typeof Slugger>, [options?: SlugOptions]>>, // new Slugger takes optional options
  Expect<Equal<Parameters<Slugger['slug']>, [text: string]>>, // slug takes a text
  Expect<Equal<ReturnType<Slugger['slug']>, string>>, // slug returns a string
  Expect<Equal<Slugger['count'], number>>, // count is a number
  Expect<Equal<typeof version, string>>, // version is a string
];

// The tests declare values of the package's types: nothing here runs.
declare const slug: typeof slugify;
declare const SluggerClass: typeof Slugger;
declare const slugger: Slugger;

// @ts-expect-error
slug(); // slugify needs a text

// @ts-expect-error
slug('Hello', { separator: 1 }); // the separator is a string

// @ts-expect-error
slug('Hello', { sep: '-' }); // there is no option called sep

// @ts-expect-error
new SluggerClass('-'); // the constructor takes options, not a separator

// @ts-expect-error
slugger.count = 0; // count is read-only

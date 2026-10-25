import type { Equal, Expect } from '@dojo/type-utils';
import type { Package, Version } from './index';

type cases = [
  Expect<Equal<Version, [number, number, number?]>>, // major, minor, then an optional patch
  Expect<
    Equal<
      Package,
      {
        readonly name: string;
        version: Version;
        description?: string;
        keywords: readonly string[];
      }
    >
  >, // the four properties and their modifiers
];

const dojo: Package = {
  name: 'ts-dojo',
  version: [1, 4],
  description: 'Learn TypeScript',
  keywords: ['typescript'],
};

// @ts-expect-error a version needs a minor number
const tooShort: Version = [1];

// @ts-expect-error a version has at most three numbers
const tooLong: Version = [1, 4, 2, 0];

// @ts-expect-error the name can't be reassigned
dojo.name = 'js-dojo';

// @ts-expect-error the keywords can't be changed in place
dojo.keywords.push('vim');

export { dojo, tooShort, tooLong };

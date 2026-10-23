import type { Equal, Expect, ExpectValidArgs } from '@dojo/type-utils';
import type { HrefArgs } from './index';

declare function href<P extends string>(
  pattern: P,
  ...args: HrefArgs<P>
): string;

type cases = [
  Expect<ExpectValidArgs<typeof href<'/about'>, ['/about']>>, // no parameters, no argument
  Expect<
    ExpectValidArgs<typeof href<'/users/:id'>, ['/users/:id', { id: string }]>
  >, // a required parameter
  Expect<ExpectValidArgs<typeof href<'/docs/:lang?'>, ['/docs/:lang?']>>, // only optional ones: left out
  Expect<
    ExpectValidArgs<
      typeof href<'/docs/:lang?'>,
      ['/docs/:lang?', { lang: string }]
    >
  >, // only optional ones: passed
  Expect<
    Equal<
      ExpectValidArgs<
        typeof href<'/users/:id/posts/:postId?'>,
        ['/users/:id/posts/:postId?']
      >,
      false
    >
  >, // one required parameter is enough to require the object
  Expect<
    ExpectValidArgs<
      typeof href<'/users/:id/posts/:postId?'>,
      ['/users/:id/posts/:postId?', { id: string }]
    >
  >, // and the optional one can stay out of it
  Expect<
    ExpectValidArgs<typeof href<'/files/*'>, ['/files/*', { '*': string }]>
  >, // a wildcard
  Expect<
    ExpectValidArgs<
      typeof href<`/api/v${number}/:resource?`>,
      [`/api/v${number}/:resource?`]
    >
  >, // a pattern type with an optional parameter
  Expect<
    Equal<
      ExpectValidArgs<
        typeof href<`/api/v${number}/:resource`>,
        [`/api/v${number}/:resource`]
      >,
      false
    >
  >, // a pattern type with a required parameter
];

// @ts-expect-error
const extra = () => href('/about', {}); // nothing after a pattern without parameters

// @ts-expect-error
const missing = () => href('/users/:id'); // the id is required

// @ts-expect-error
const noRest = () => href('/files/*'); // so is the wildcard

// @ts-expect-error
const misspelt = () => href('/docs/:lang?', { locale: 'en' }); // not a parameter

export { extra, missing, noRest, misspelt };

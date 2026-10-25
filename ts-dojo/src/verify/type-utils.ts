// `@dojo/type-utils` (spec §5 Type cases): a vendored copy of type-challenges' utils/index.d.ts,
// declared as an ambient module so `import type { Equal, Expect } from '@dojo/type-utils'` in
// a tests.ts resolves inside the virtual file system with no `paths` entry (F2's tests used the
// same mechanism; F6 made it the one the app ships). Added to every project that has a
// tests.ts as /dojo/type-utils.d.ts (src/workers/ts-ls/ambient.ts).
//
// Source: https://github.com/type-challenges/type-challenges/blob/main/utils/index.d.ts
// MIT License, Copyright (c) 2020-present Anthony Fu <https://github.com/antfu>.
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software
// and associated documentation files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following conditions: The above copyright
// notice and this permission notice shall be included in all copies or substantial portions of
// the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

export const TYPE_UTILS_MODULE = '@dojo/type-utils';

export const TYPE_UTILS_DTS = `// @dojo/type-utils: type-challenges' utils/index.d.ts (MIT), added by ts-dojo to every project with a tests.ts.
declare module '@dojo/type-utils' {
  export type Expect<T extends true> = T;
  export type ExpectTrue<T extends true> = T;
  export type ExpectFalse<T extends false> = T;
  export type IsTrue<T extends true> = T;
  export type IsFalse<T extends false> = T;

  export type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
  export type NotEqual<X, Y> = true extends Equal<X, Y> ? false : true;

  // https://stackoverflow.com/questions/49927523/disallow-call-with-any/49928360#49928360
  export type IsAny<T> = 0 extends 1 & T ? true : false;
  export type NotAny<T> = true extends IsAny<T> ? false : true;

  export type Debug<T> = { [K in keyof T]: T[K] };
  export type MergeInsertions<T> = T extends object ? { [K in keyof T]: MergeInsertions<T[K]> } : T;

  export type Alike<X, Y> = Equal<MergeInsertions<X>, MergeInsertions<Y>>;

  export type ExpectExtends<VALUE, EXPECTED> = EXPECTED extends VALUE ? true : false;
  export type ExpectValidArgs<FUNC extends (...args: any[]) => any, ARGS extends any[]> =
    ARGS extends Parameters<FUNC> ? true : false;

  export type UnionToIntersection<U> =
    (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
}
`;

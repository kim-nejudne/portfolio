import type { Equal, Expect, ExpectValidArgs } from '@dojo/type-utils';
import type { ParseOptions, parse, pick } from 'tiny-query';

// The tests declare values of the declared types: nothing here runs.
declare const parseQuery: typeof parse;
declare const pickParams: typeof pick;

const single = parseQuery('page=2&q=ts');
const singleOff = parseQuery('page=2', { arrays: false });
const lists = parseQuery('tag=a&tag=b', { arrays: true });
const paging = pickParams({ page: '2', q: 'ts', sort: 'new' }, 'page', 'q');
const retries = pickParams({ debug: true, retries: 3 }, 'retries');
const pickId = <T extends { id: number }>(row: T) => pickParams(row, 'id');

type cases = [
  Expect<Equal<typeof single, Record<string, string>>>, // no options: one string per key
  Expect<Equal<typeof singleOff, Record<string, string>>>, // arrays false: the same
  Expect<Equal<typeof lists, Record<string, string[]>>>, // arrays true: a list per key
  Expect<ExpectValidArgs<typeof parse, [string, ParseOptions]>>, // any options are accepted
  Expect<
    Equal<
      ReturnType<typeof parse>,
      Record<string, string> | Record<string, string[]>
    >
  >, // and give either record
  Expect<Equal<typeof paging, { page: string; q: string }>>, // pick keeps the picked keys
  Expect<Equal<typeof retries, { retries: number }>>, // with their own types
  Expect<
    Equal<
      ReturnType<typeof pickId<{ id: number; name: string }>>,
      { id: number }
    >
  >, // for any object, not only the ones above
];

// @ts-expect-error
pickParams({ page: '2' }, 'sort'); // only keys of the params

// @ts-expect-error
parseQuery('page=2', { arrays: 'yes' }); // arrays is a boolean

// @ts-expect-error
parseQuery(42); // the query is a string

import type { Equal, Expect } from '@dojo/type-utils';
import type { Params } from './index';

// Patterns made by a type: /orgs/:orgId/teams/:teamId/...
type Nested<Names extends string[]> = Names extends [
  infer N extends string,
  ...infer Rest extends string[],
]
  ? `/${N}s/:${N}Id${Nested<Rest>}`
  : '';

type cases = [
  Expect<
    Equal<Params<'/users/:id/posts/:postId'>, { id: string; postId: string }>
  >, // two parameters
  Expect<Equal<Params<'/users/:id'>, { id: string }>>, // one parameter
  Expect<Equal<Params<'/about'>, {}>>, // no parameters
  Expect<Equal<Params<'/'>, {}>>, // the root
  Expect<Equal<Params<':lang/docs/:page'>, { lang: string; page: string }>>, // no leading slash
  Expect<Equal<Params<'/at/12:30/:room'>, { room: string }>>, // a colon inside a segment is text
  Expect<Equal<Params<'/posts/:post-id'>, { 'post-id': string }>>, // a name runs to the next slash
  Expect<Equal<Params<`/v${number}/items/:itemId`>, { itemId: string }>>, // a pattern type
  Expect<
    Equal<
      Params<Nested<['org', 'team', 'project', 'board', 'card']>>,
      {
        orgId: string;
        teamId: string;
        projectId: string;
        boardId: string;
        cardId: string;
      }
    >
  >, // a generated pattern
];

// @ts-expect-error
const missing: Params<'/users/:id'> = {}; // the id is required

// @ts-expect-error
const misspelt: Params<'/users/:id'> = { userId: '7' }; // no such parameter

export { missing, misspelt };

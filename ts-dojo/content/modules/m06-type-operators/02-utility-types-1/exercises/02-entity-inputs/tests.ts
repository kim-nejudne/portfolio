import type { Equal, Expect } from '@dojo/type-utils';
import type { CreateInput, Summary, UpdateInput } from './index';

type User = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  bio?: string;
};

type Post = {
  id: string;
  createdAt: string;
  title: string;
  tags: string[];
  published: boolean;
};

type cases = [
  Expect<
    Equal<CreateInput<User>, { name: string; email: string; bio?: string }>
  >, // a new user has no id or createdAt
  Expect<
    Equal<
      CreateInput<Post>,
      { title: string; tags: string[]; published: boolean }
    >
  >, // a new post has no id or createdAt
  Expect<
    Equal<UpdateInput<User>, { name?: string; email?: string; bio?: string }>
  >, // every changeable user field is optional
  Expect<
    Equal<
      UpdateInput<Post>,
      { title?: string; tags?: string[]; published?: boolean }
    >
  >, // every changeable post field is optional
  Expect<
    Equal<Summary<User, 'name'>, { readonly id: string; readonly name: string }>
  >, // a user summary with the name
  Expect<
    Equal<
      Summary<Post, 'title' | 'published'>,
      {
        readonly id: string;
        readonly title: string;
        readonly published: boolean;
      }
    >
  >, // a post summary with two fields
];

// @ts-expect-error
type NoEntity = CreateInput<{ name: string }>; // a type without id and createdAt is not an entity

// @ts-expect-error
type NoEntityUpdate = UpdateInput<{ id: string; name: string }>; // createdAt is missing

// @ts-expect-error
type Misspelt = Summary<User, 'emial'>; // emial is not a field of User

// @ts-expect-error
const withId: CreateInput<User> = { id: 'u1', name: 'Ada', email: 'a@b' }; // a new user can't choose its id

// @ts-expect-error
const empty: CreateInput<Post> = {}; // creating a post needs its fields

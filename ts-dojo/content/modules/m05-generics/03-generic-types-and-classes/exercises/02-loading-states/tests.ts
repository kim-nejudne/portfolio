import type { Equal, Expect } from '@dojo/type-utils';
import type { AsyncState } from './index';

type User = { id: string; name: string };

type cases = [
  Expect<
    Equal<
      AsyncState<User>,
      | { status: 'idle' }
      | { status: 'loading' }
      | { status: 'success'; data: User }
      | { status: 'error'; error: Error }
    >
  >, // the data has the first type argument's type, and the error is an Error
  Expect<
    Equal<
      AsyncState<number[], string>,
      | { status: 'idle' }
      | { status: 'loading' }
      | { status: 'success'; data: number[] }
      | { status: 'error'; error: string }
    >
  >, // a second type argument sets the error's type
];

const idle: AsyncState<number> = { status: 'idle' };
const loaded: AsyncState<number> = { status: 'success', data: 42 };
const failed: AsyncState<number> = {
  status: 'error',
  error: new Error('offline'),
};

// @ts-expect-error
const wrongData: AsyncState<number> = { status: 'success', data: 'ten' }; // data has the type argument's type

// @ts-expect-error
const noData: AsyncState<number> = { status: 'success' }; // a success carries its data

// @ts-expect-error
const loadingWithData: AsyncState<number> = { status: 'loading', data: 1 }; // loading has no data yet

// @ts-expect-error
const messageError: AsyncState<number> = { status: 'error', error: 'offline' }; // the error is an Error by default

// @ts-expect-error
const done: AsyncState<number> = { status: 'done', data: 1 }; // done is not one of the four

// @ts-expect-error
type NoTypeArgument = AsyncState; // the data type has no default

export {
  idle,
  loaded,
  failed,
  wrongData,
  noData,
  loadingWithData,
  messageError,
  done,
};
export type { NoTypeArgument };

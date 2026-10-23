// Define AsyncState<T, E>: idle, loading, success with data of type T,
// and error with an error of type E, which is Error unless a second type argument says otherwise.
// Every member has a `status` property that tells them apart.
export type AsyncState<T, E = Error> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E };

export type ActionOf<M, K extends keyof M = keyof M> = {
  [P in keyof M]: M[P] extends void ? { type: P } : { type: P; payload: M[P] };
}[K];

export type Action = { type: string };
export type Reducer<S, A extends Action> = (state: S, action: A) => S;
export type Listener<S, A> = (state: S, action: A) => void;

export interface Store<S, A extends Action> {
  getState(): S;
  dispatch(action: A): void;
  subscribe(listener: Listener<S, A>): () => void;
  select<R>(selector: (state: S) => R): R;
  // Loose for now: any type string, any action, and unknown values.
  on(type: string, listener: (action: A, state: S) => void): () => void;
  watch(
    selector: (state: S) => unknown,
    listener: (next: unknown, previous: unknown) => void,
  ): () => void;
}

export function createStore<S, A extends Action>(
  reducer: Reducer<S, A>,
  initial: S,
): Store<S, A> {
  throw new Error('createStore is not implemented');
}

export type Action = { type: string };
export type Reducer<S, A extends Action> = (state: S, action: A) => S;

// Loose for now: any action goes in, and select returns unknown.
export interface Store<S> {
  getState(): S;
  dispatch(action: { type: string; payload?: unknown }): void;
  subscribe(listener: (state: S, action: Action) => void): () => void;
  select(selector: (state: S) => unknown): unknown;
}

export function createStore<S, A extends Action>(
  reducer: Reducer<S, A>,
  initial: S,
): Store<S> {
  throw new Error('createStore is not implemented');
}

export type Action = { type: string };
export type Reducer<S, A extends Action> = (state: S, action: A) => S;
export type Listener<S, A> = (state: S, action: A) => void;

export interface Store<S, A extends Action> {
  getState(): S;
  dispatch(action: A): void;
  subscribe(listener: Listener<S, A>): () => void;
  // R is the method's own type parameter, inferred from each selector.
  select<R>(selector: (state: S) => R): R;
}

export function createStore<S, A extends Action>(
  reducer: Reducer<S, A>,
  initial: S,
): Store<S, A> {
  let state = initial;
  const listeners = new Set<Listener<S, A>>();

  return {
    getState: () => state,
    dispatch(action) {
      const next = reducer(state, action);
      if (Object.is(next, state)) return;
      state = next;
      for (const listener of [...listeners]) listener(state, action);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    select: (selector) => selector(state),
  };
}

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
  // K is one of the action types, and Extract keeps the members of A with that type.
  on<K extends A['type']>(
    type: K,
    listener: (action: Extract<A, { type: K }>, state: S) => void,
  ): () => void;
  watch<R>(
    selector: (state: S) => R,
    listener: (next: R, previous: R) => void,
  ): () => void;
}

// Comparing action.type with a K doesn't narrow the type parameter A, so a type guard says
// what the comparison proves.
function hasType<A extends Action, K extends A['type']>(
  action: A,
  type: K,
): action is Extract<A, { type: K }> {
  return action.type === type;
}

export function createStore<S, A extends Action>(
  reducer: Reducer<S, A>,
  initial: S,
): Store<S, A> {
  let state = initial;
  const listeners = new Set<Listener<S, A>>();
  const actionListeners = new Set<Listener<S, A>>();

  const store: Store<S, A> = {
    getState: () => state,
    dispatch(action) {
      const previous = state;
      state = reducer(state, action);
      for (const listener of [...actionListeners]) listener(state, action);
      if (Object.is(previous, state)) return;
      for (const listener of [...listeners]) listener(state, action);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    select: (selector) => selector(state),
    on(type, listener) {
      const forType: Listener<S, A> = (next, action) => {
        if (hasType(action, type)) listener(action, next);
      };
      actionListeners.add(forType);
      return () => {
        actionListeners.delete(forType);
      };
    },
    watch(selector, listener) {
      let last = selector(state);
      return store.subscribe((next) => {
        const value = selector(next);
        if (Object.is(value, last)) return;
        const previous = last;
        last = value;
        listener(value, previous);
      });
    },
  };
  return store;
}

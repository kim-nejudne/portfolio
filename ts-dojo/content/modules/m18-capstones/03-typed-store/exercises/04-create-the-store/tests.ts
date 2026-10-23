import type { Equal, Expect } from '@dojo/type-utils';
import { createStore } from './index';

type Item = { sku: string; qty: number };
type CartState = {
  readonly items: readonly Item[];
  readonly coupon: string | null;
};
type CartAction =
  | { type: 'add'; payload: Item }
  | { type: 'remove'; payload: string }
  | { type: 'applyCoupon'; payload: string };

// Returns the same state object when an action changes nothing.
function cart(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add':
      return { ...state, items: [...state.items, action.payload] };
    case 'remove': {
      const items = state.items.filter((item) => item.sku !== action.payload);
      return items.length === state.items.length ? state : { ...state, items };
    }
    case 'applyCoupon':
      return state.coupon === action.payload
        ? state
        : { ...state, coupon: action.payload };
  }
}

const empty: CartState = { items: [], coupon: null };
const makeStore = () => createStore(cart, empty);
type CartStore = ReturnType<typeof makeStore>;
declare const store: CartStore;

const selectCount = () => store.select((state) => state.items.length);
const selectSkus = () => store.select((state) => state.items.map((i) => i.sku));
type CartListener = Parameters<CartStore['subscribe']>[0];

type cases = [
  Expect<Equal<ReturnType<CartStore['getState']>, CartState>>, // getState
  Expect<Equal<Parameters<CartStore['dispatch']>[0], CartAction>>, // dispatch takes the reducer's actions
  Expect<Equal<Parameters<CartListener>[0], CartState>>, // a listener gets the state
  Expect<Equal<Parameters<CartListener>[1], CartAction>>, // and the action
  Expect<Equal<ReturnType<typeof selectCount>, number>>, // select infers a number
  Expect<Equal<ReturnType<typeof selectSkus>, string[]>>, // and a list of strings
];

// @ts-expect-error
const wrongPayload = () => store.dispatch({ type: 'remove', payload: 1 }); // a sku is a string

// @ts-expect-error
const unknownType = () => store.dispatch({ type: 'empty' }); // the cart has no empty action

export { wrongPayload, unknownType };

const apple: Item = { sku: 'apple', qty: 2 };
const pear: Item = { sku: 'pear', qty: 1 };

test('getState returns the initial state before any dispatch', () => {
  const initial: CartState = { items: [pear], coupon: 'WELCOME' };
  expect(createStore(cart, initial).getState()).toBe(initial);
});

test('dispatch runs the reducer on the current state', () => {
  const cartStore = createStore(cart, empty);
  cartStore.dispatch({ type: 'add', payload: apple });
  cartStore.dispatch({ type: 'add', payload: pear });
  cartStore.dispatch({ type: 'remove', payload: 'apple' });
  cartStore.dispatch({ type: 'applyCoupon', payload: 'SPRING' });
  expect(cartStore.getState()).toEqual({ items: [pear], coupon: 'SPRING' });
});

test('dispatch works for any reducer', () => {
  type Step = { type: 'step'; payload: number };
  const counter = createStore(
    (n: number, action: Step) => n + action.payload,
    0,
  );
  for (let i = 1; i <= 5; i++) counter.dispatch({ type: 'step', payload: i });
  expect(counter.getState()).toBe(15);
});

test('listeners get the new state and the action, in order', () => {
  const cartStore = createStore(cart, empty);
  const seen: string[] = [];
  cartStore.subscribe((state, action) => {
    expect(state).toBe(cartStore.getState());
    seen.push(`first ${action.type} ${state.items.length}`);
  });
  cartStore.subscribe((state, action) =>
    seen.push(`second ${action.type} ${state.items.length}`),
  );
  cartStore.dispatch({ type: 'add', payload: apple });
  cartStore.dispatch({ type: 'remove', payload: 'apple' });
  expect(seen).toEqual([
    'first add 1',
    'second add 1',
    'first remove 0',
    'second remove 0',
  ]);
});

test('no listener runs when the reducer returns the same state', () => {
  const cartStore = createStore(cart, empty);
  let calls = 0;
  cartStore.subscribe(() => calls++);
  cartStore.dispatch({ type: 'remove', payload: 'apple' });
  cartStore.dispatch({ type: 'applyCoupon', payload: 'SPRING' });
  cartStore.dispatch({ type: 'applyCoupon', payload: 'SPRING' });
  expect(calls).toBe(1);
  expect(cartStore.getState().coupon).toBe('SPRING');
});

test('subscribe returns a function that removes that listener only', () => {
  const cartStore = createStore(cart, empty);
  const seen: string[] = [];
  const stopA = cartStore.subscribe(() => seen.push('a'));
  cartStore.subscribe(() => seen.push('b'));
  cartStore.dispatch({ type: 'add', payload: apple });
  stopA();
  cartStore.dispatch({ type: 'add', payload: pear });
  stopA();
  cartStore.dispatch({ type: 'remove', payload: 'pear' });
  expect(seen).toEqual(['a', 'b', 'b', 'b']);
});

test('select reads the current state', () => {
  const cartStore = createStore(cart, empty);
  for (let i = 1; i <= 4; i++) {
    cartStore.dispatch({ type: 'add', payload: { sku: `sku${i}`, qty: i } });
    expect(cartStore.select((state) => state.items.length)).toBe(i);
  }
  const total = cartStore.select((state) =>
    state.items.reduce((sum, item) => sum + item.qty, 0),
  );
  expect(total).toBe(10);
});

test('stores do not share state or listeners', () => {
  const first = createStore(cart, empty);
  const second = createStore(cart, empty);
  let calls = 0;
  first.subscribe(() => calls++);
  second.dispatch({ type: 'add', payload: apple });
  expect(calls).toBe(0);
  expect(first.getState().items).toEqual([]);
});

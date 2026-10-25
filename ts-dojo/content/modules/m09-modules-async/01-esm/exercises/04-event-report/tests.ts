import type { Equal, Expect } from '@dojo/type-utils';
import * as api from './index';
import {
  countByType,
  describeEvent,
  summary,
  type AppEvent,
  type EventType,
} from './index';

type cases = [
  Expect<Equal<EventType, 'login' | 'logout' | 'purchase'>>, // the barrel re-exports EventType
  Expect<Equal<Parameters<typeof describeEvent>, [event: AppEvent]>>, // describeEvent takes an AppEvent
  Expect<Equal<ReturnType<typeof countByType>, Record<EventType, number>>>, // countByType returns a count per type
];

const users = ['Ada', 'Grace', 'Linus'];

test('describes logins and logouts', () => {
  for (const user of users) {
    expect(describeEvent({ type: 'login', user })).toBe(`${user} logged in`);
    expect(describeEvent({ type: 'logout', user })).toBe(`${user} logged out`);
  }
});

test('describes purchases of many amounts', () => {
  expect(describeEvent({ type: 'purchase', user: 'Ada', cents: 1250 })).toBe(
    'Ada spent €12.50',
  );
  for (let cents = 0; cents <= 3000; cents += 137) {
    expect(describeEvent({ type: 'purchase', user: 'Grace', cents })).toBe(
      `Grace spent €${(cents / 100).toFixed(2)}`,
    );
  }
});

test('describeEvent throws for an event the types do not describe', () => {
  // JSON.parse returns any, so this compiles although no member has the type 'refund'.
  const refund: AppEvent = JSON.parse('{"type":"refund","user":"Ada"}');
  expect(() => describeEvent(refund)).toThrow('unhandled event');
});

test('counts nothing as zero of every type', () => {
  expect(countByType([])).toEqual({ login: 0, logout: 0, purchase: 0 });
});

test('counts events of every type in any order', () => {
  for (let n = 0; n <= 6; n++) {
    const events: AppEvent[] = [];
    for (let i = 0; i < n; i++) {
      events.push({ type: 'login', user: users[i % 3] });
      events.push({ type: 'purchase', user: 'Ada', cents: i });
      events.push({ type: 'purchase', user: 'Grace', cents: i });
    }
    events.push({ type: 'logout', user: 'Linus' });
    expect(countByType(events.reverse())).toEqual({
      login: n,
      logout: 1,
      purchase: 2 * n,
    });
  }
});

test('countByType does not change its input', () => {
  const events: readonly AppEvent[] = [
    { type: 'login', user: 'Ada' },
    { type: 'logout', user: 'Ada' },
  ];
  countByType(events);
  expect(events).toEqual([
    { type: 'login', user: 'Ada' },
    { type: 'logout', user: 'Ada' },
  ]);
});

test('the summary lists every type in order', () => {
  expect(
    summary([
      { type: 'purchase', user: 'Ada', cents: 5 },
      { type: 'login', user: 'Ada' },
      { type: 'purchase', user: 'Ada', cents: 7 },
    ]),
  ).toBe('login 1, logout 0, purchase 2');
});

test('the barrel exports exactly the three functions at run time', () => {
  // Types are erased: they add nothing to the module object. eventTypes stays private.
  expect(Object.keys(api).sort()).toEqual([
    'countByType',
    'describeEvent',
    'summary',
  ]);
});

import type { Equal, Expect, ExpectExtends } from '@dojo/type-utils';
import {
  apply,
  assertNever,
  monthlyCost,
  plans,
  type Change,
  type Plan,
  type PlanName,
  type Subscription,
} from './index';

type cases = [
  Expect<
    Equal<
      Plan,
      {
        pricePerSeat: number;
        maxSeats: number | 'unlimited';
        invoiceLine: (seats: number) => string;
      }
    >
  >, // Plan is unchanged
  Expect<ExpectExtends<Record<string, Plan>, typeof plans>>, // every entry of plans is a Plan
  Expect<Equal<PlanName, 'free' | 'team' | 'business'>>, // PlanName lists the three plans
  Expect<Equal<typeof plans.free.pricePerSeat, 0>>, // plans keeps its literal values
  Expect<Equal<typeof plans.team.maxSeats, 50>>, // the team limit is the literal 50
  Expect<Equal<typeof plans.business.maxSeats, 'unlimited'>>, // business has no limit
  Expect<Equal<typeof assertNever, (value: never) => never>>, // assertNever takes never and returns never
];

const team: Subscription = { plan: 'team', seats: 5 };

// @ts-expect-error
const gold: Change = { type: 'switch-plan', plan: 'gold' }; // gold is not a plan

// @ts-expect-error
const enterprise: Subscription = { plan: 'enterprise', seats: 1 }; // enterprise is not a plan

// @ts-expect-error
const raiseTheLimit = () => (plans.team.maxSeats = 60); // the list of plans is read-only

test('assertNever throws with the value as JSON', () => {
  expect(() => assertNever(7 as never)).toThrow('unexpected value: 7');
  expect(() => assertNever({ type: 'pause' } as never)).toThrow(
    'unexpected value: {"type":"pause"}',
  );
  expect(() => assertNever('gold' as never)).toThrow(
    'unexpected value: "gold"',
  );
});

test('the invoice lines are the ones in the list', () => {
  for (const seats of [1, 3, 12]) {
    expect(plans.free.invoiceLine(seats)).toBe(`Free plan, ${seats} seats`);
    expect(plans.team.invoiceLine(seats)).toBe(
      `Team plan, ${seats} seats at 8 EUR`,
    );
    expect(plans.business.invoiceLine(seats)).toBe(
      `Business plan, ${seats} seats at 15 EUR`,
    );
  }
});

test('monthlyCost multiplies the seats by the price of a seat', () => {
  for (let seats = 1; seats <= 50; seats += 7) {
    expect(monthlyCost({ plan: 'free', seats })).toBe(0);
    expect(monthlyCost({ plan: 'team', seats })).toBe(8 * seats);
    expect(monthlyCost({ plan: 'business', seats })).toBe(15 * seats);
  }
});

test('add-seats adds seats up to the limit', () => {
  for (let count = 1; count <= 45; count += 4) {
    expect(apply(team, { type: 'add-seats', count })).toEqual({
      plan: 'team',
      seats: 5 + count,
    });
  }
  expect(
    apply({ plan: 'free', seats: 1 }, { type: 'add-seats', count: 2 }),
  ).toEqual({ plan: 'free', seats: 3 });
});

test('add-seats throws a RangeError past the limit', () => {
  expect(() => apply(team, { type: 'add-seats', count: 46 })).toThrow();
  expect(() =>
    apply({ plan: 'free', seats: 3 }, { type: 'add-seats', count: 1 }),
  ).toThrow();
  for (const change of [
    { type: 'add-seats', count: 100 },
    { type: 'remove-seats', count: 5 },
    { type: 'switch-plan', plan: 'free' },
  ] satisfies Change[]) {
    let thrown: unknown;
    try {
      apply(team, change);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RangeError);
  }
});

test('business has no limit', () => {
  for (const count of [1, 100, 5000, 1_000_000]) {
    expect(
      apply({ plan: 'business', seats: 10 }, { type: 'add-seats', count }),
    ).toEqual({ plan: 'business', seats: 10 + count });
  }
});

test('remove-seats keeps at least one seat', () => {
  for (let count = 1; count <= 4; count++) {
    expect(apply(team, { type: 'remove-seats', count })).toEqual({
      plan: 'team',
      seats: 5 - count,
    });
  }
  expect(() => apply(team, { type: 'remove-seats', count: 5 })).toThrow();
  expect(() => apply(team, { type: 'remove-seats', count: 9 })).toThrow();
});

test('switch-plan keeps the seats when they fit the new plan', () => {
  expect(apply(team, { type: 'switch-plan', plan: 'business' })).toEqual({
    plan: 'business',
    seats: 5,
  });
  expect(
    apply(
      { plan: 'business', seats: 50 },
      { type: 'switch-plan', plan: 'team' },
    ),
  ).toEqual({ plan: 'team', seats: 50 });
  expect(
    apply({ plan: 'team', seats: 3 }, { type: 'switch-plan', plan: 'free' }),
  ).toEqual({ plan: 'free', seats: 3 });
});

test('switch-plan throws when the seats do not fit the new plan', () => {
  expect(() =>
    apply(
      { plan: 'business', seats: 51 },
      { type: 'switch-plan', plan: 'team' },
    ),
  ).toThrow();
  expect(() => apply(team, { type: 'switch-plan', plan: 'free' })).toThrow();
});

test('apply returns a new subscription and leaves its input alone', () => {
  const before: Subscription = { plan: 'team', seats: 5 };
  const after = apply(before, { type: 'add-seats', count: 1 });
  expect(after).not.toBe(before);
  expect(before).toEqual({ plan: 'team', seats: 5 });
});

test('a change the types do not describe throws', () => {
  // JSON.parse returns any, so this compiles although no member has the type 'pause'.
  const pause: Change = JSON.parse('{"type":"pause","days":7}');
  expect(() => apply(team, pause)).toThrow('unexpected value: {"type":"pause"');
});

export { gold, enterprise, raiseTheLimit };

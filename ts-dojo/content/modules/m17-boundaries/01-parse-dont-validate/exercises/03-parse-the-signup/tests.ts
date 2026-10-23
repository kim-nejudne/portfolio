import type { Equal, Expect } from '@dojo/type-utils';
import {
  parseEmail,
  parseSignup,
  type Email,
  type Result,
  type Signup,
} from './index';

type cases = [
  Expect<Equal<ReturnType<typeof parseEmail>, Result<Email>>>, // parseEmail returns a Result of Email
  Expect<Equal<ReturnType<typeof parseSignup>, Result<Signup>>>, // parseSignup returns a Result of Signup
  Expect<Equal<Signup['email'], Email>>, // the email field stays branded
];

// @ts-expect-error
const plain: Email = 'ada@example.com'; // a plain string is no Email

export { plain };

function fails(path: string[], message: string) {
  return { ok: false, error: { path, message } };
}

test('parseEmail trims and lower-cases an address', () => {
  expect(parseEmail('ada@example.com')).toEqual({
    ok: true,
    value: 'ada@example.com',
  });
  expect(parseEmail('  Grace@Navy.MIL \n')).toEqual({
    ok: true,
    value: 'grace@navy.mil',
  });
});

test('parseEmail parses generated addresses', () => {
  for (let i = 0; i < 20; i++) {
    const address = `User${i}@Host${i * 7}.org`;
    expect(parseEmail(` ${address} `)).toEqual({
      ok: true,
      value: address.toLowerCase(),
    });
  }
});

test('parseEmail rejects what is no address', () => {
  for (const input of [
    'ada',
    'ada@',
    '@example.com',
    'a b@example.com',
    'a@b@c',
    '',
    '   ',
    42,
    null,
    undefined,
    ['ada@example.com'],
    { email: 'ada@example.com' },
  ]) {
    expect(parseEmail(input)).toEqual(fails([], 'expected an email address'));
  }
});

test('parseSignup returns exactly the fields of Signup', () => {
  const result = parseSignup(
    JSON.parse(
      '{"email":" Ada@Example.com","age":36,"newsletter":true,"admin":true,"plan":"pro"}',
    ),
  );
  expect(result).toEqual({
    ok: true,
    value: { email: 'ada@example.com', age: 36, newsletter: true },
  });
  if (result.ok) {
    expect(Object.keys(result.value).sort()).toEqual([
      'age',
      'email',
      'newsletter',
    ]);
  }
});

test('parseSignup parses many forms', () => {
  for (let age = 13; age <= 120; age += 9) {
    const newsletter = age % 2 === 0;
    const email = `reader${age}@example.com`;
    expect(parseSignup({ email, age, newsletter, ref: age })).toEqual({
      ok: true,
      value: { email, age, newsletter },
    });
  }
});

test('parseSignup makes a missing newsletter false', () => {
  expect(parseSignup({ email: 'ada@example.com', age: 36 })).toEqual({
    ok: true,
    value: { email: 'ada@example.com', age: 36, newsletter: false },
  });
});

test('parseSignup rejects what is no object', () => {
  for (const input of [null, undefined, 'ada', 36, true, [], [{ age: 36 }]]) {
    expect(parseSignup(input)).toEqual(fails([], 'expected an object'));
  }
});

test('parseSignup reports the email first', () => {
  for (const input of [
    {},
    { age: 36 },
    { email: 'ada', age: 36 },
    { email: 7, age: 'old', newsletter: 'yes' },
  ]) {
    expect(parseSignup(input)).toEqual(
      fails(['email'], 'expected an email address'),
    );
  }
});

test('parseSignup reports a bad age', () => {
  for (const age of [undefined, '36', 12, 121, 36.5, Number.NaN, null]) {
    expect(parseSignup({ email: 'ada@example.com', age })).toEqual(
      fails(['age'], 'expected a whole number from 13 to 120'),
    );
  }
  expect(parseSignup({ email: 'ada@example.com' })).toEqual(
    fails(['age'], 'expected a whole number from 13 to 120'),
  );
});

test('parseSignup reports a newsletter that is no boolean', () => {
  for (const newsletter of ['true', 1, null, {}]) {
    expect(
      parseSignup({ email: 'ada@example.com', age: 36, newsletter }),
    ).toEqual(fails(['newsletter'], 'expected true or false'));
  }
});

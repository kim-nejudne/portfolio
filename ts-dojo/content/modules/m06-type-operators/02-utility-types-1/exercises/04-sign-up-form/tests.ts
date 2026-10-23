import type { Equal, Expect } from '@dojo/type-utils';
import {
  submit,
  validate,
  type Draft,
  type FormErrors,
  type SignUp,
} from './index';

type cases = [
  Expect<
    Equal<
      Draft,
      { email?: string; password?: string; age?: number; inviteCode?: string }
    >
  >, // a draft is any subset of SignUp
  Expect<
    Equal<
      FormErrors,
      { email?: string; password?: string; age?: string; inviteCode?: string }
    >
  >, // at most one message per field of SignUp
];

// @ts-expect-error
const nickname = validate({ nickname: 'ada' }); // SignUp has no nickname

// @ts-expect-error
const textAge = validate({ age: '36' }); // an age is still a number

// @ts-expect-error
const username: FormErrors = { username: 'Taken.' }; // no message for a field SignUp doesn't have

const EMAIL = 'Enter an email address.';
const PASSWORD = 'Use at least 8 characters.';
const AGE = 'You must be 13 or older.';
const INVITE = 'Invite codes have 6 characters.';

const valid: SignUp = {
  email: 'ada@example.com',
  password: 'analytical',
  age: 36,
};

test('a complete, valid draft has no errors', () => {
  expect(validate(valid)).toEqual({});
  expect(validate({ ...valid, inviteCode: 'ENG-01' })).toEqual({});
});

test('an empty draft fails every required field, and not the optional one', () => {
  expect(validate({})).toEqual({ email: EMAIL, password: PASSWORD, age: AGE });
});

test('email needs an @', () => {
  for (const email of ['', 'ada', 'ada.example.com', 'ada at example.com']) {
    expect(validate({ ...valid, email })).toEqual({ email: EMAIL });
  }
  for (const email of ['@', 'a@b', 'grace@navy.mil', 'x@y.z']) {
    expect(validate({ ...valid, email })).toEqual({});
  }
});

test('password needs at least 8 characters', () => {
  for (let length = 0; length <= 16; length += 1) {
    const password = 'p'.repeat(length);
    expect(validate({ ...valid, password })).toEqual(
      length < 8 ? { password: PASSWORD } : {},
    );
  }
});

test('age must be a whole number of at least 13', () => {
  for (let age = 0; age <= 120; age += 1) {
    expect(validate({ ...valid, age })).toEqual(age < 13 ? { age: AGE } : {});
  }
  for (const age of [13.5, 20.25, -1, Number.NaN]) {
    expect(validate({ ...valid, age })).toEqual({ age: AGE });
  }
});

test('an invite code is optional, and has 6 characters when present', () => {
  for (let length = 0; length <= 10; length += 1) {
    const inviteCode = 'c'.repeat(length);
    expect(validate({ ...valid, inviteCode })).toEqual(
      length === 6 ? {} : { inviteCode: INVITE },
    );
  }
  expect(validate({ ...valid, inviteCode: undefined })).toEqual({});
});

test('validate reports every failing field at once', () => {
  expect(
    validate({ email: 'ada', password: 'short', age: 9, inviteCode: 'x' }),
  ).toEqual({ email: EMAIL, password: PASSWORD, age: AGE, inviteCode: INVITE });
  expect(validate({ password: 'long enough', age: 12 })).toEqual({
    email: EMAIL,
    age: AGE,
  });
});

test('submit returns the errors of a draft that fails', () => {
  expect(submit({})).toEqual({
    ok: false,
    errors: { email: EMAIL, password: PASSWORD, age: AGE },
  });
  expect(submit({ ...valid, age: 12 })).toEqual({
    ok: false,
    errors: { age: AGE },
  });
  expect(submit({ ...valid, inviteCode: 'ABC' })).toEqual({
    ok: false,
    errors: { inviteCode: INVITE },
  });
});

test('submit returns a new SignUp for a valid draft', () => {
  for (let age = 13; age <= 90; age += 7) {
    const draft: Draft = {
      email: `user${age}@example.com`,
      password: 'p'.repeat(age),
      age,
    };
    const result = submit(draft);
    expect(result).toEqual({ ok: true, value: draft });
    if (result.ok) {
      expect(result.value).not.toBe(draft);
    }
  }
});

test('the SignUp has an invite code only when the draft has one', () => {
  expect(submit({ ...valid, inviteCode: 'ENG-01' })).toEqual({
    ok: true,
    value: { ...valid, inviteCode: 'ENG-01' },
  });
  expect(submit({ ...valid, inviteCode: undefined })).toEqual({
    ok: true,
    value: valid,
  });
});

test('the SignUp holds only the fields of SignUp', () => {
  const extra = { ...valid, nickname: 'ada', newsletter: true };
  expect(submit(extra)).toEqual({ ok: true, value: valid });
});

export { nickname, textAge, username };

import type { Equal, Expect } from '@dojo/type-utils';
import { signUpRules, validate, type Rules, type SignUp } from './index';

type Message = string | null;

type cases = [
  Expect<
    Equal<
      Rules<SignUp>,
      {
        email: (value: string) => Message;
        password: (value: string) => Message;
        age: (value: number) => Message;
        inviteCode: (value: string | undefined) => Message;
      }
    >
  >, // one required rule per field of SignUp
  Expect<
    Equal<
      Rules<{ title: string; done?: boolean }>,
      {
        title: (value: string) => Message;
        done: (value: boolean | undefined) => Message;
      }
    >
  >, // works for any type
];

const pass = () => null;

// @ts-expect-error
const noInvite: Rules<SignUp> = { email: pass, password: pass, age: pass }; // every field needs a rule

// @ts-expect-error
const extra: Rules<SignUp> = { ...signUpRules, nickname: pass }; // no nickname

// @ts-expect-error
const textAge: Rules<SignUp> = { ...signUpRules, age: (age: string) => null }; // an age is a number

const EMAIL = 'Enter an email address.';
const PASSWORD = 'Use at least 8 characters.';
const AGE = 'You must be 13 or older.';
const INVITE = 'Invite codes have 6 characters.';

const valid: SignUp = {
  email: 'ada@example.com',
  password: 'analytical',
  age: 36,
};

test('a valid sign-up has no errors, with or without an invite code', () => {
  expect(validate(signUpRules, valid)).toEqual({});
  expect(validate(signUpRules, { ...valid, inviteCode: 'ENG-01' })).toEqual({});
  expect(validate(signUpRules, { ...valid, inviteCode: undefined })).toEqual(
    {},
  );
});

test('an invite code must have exactly 6 characters', () => {
  for (let length = 0; length <= 12; length += 1) {
    const inviteCode = 'c'.repeat(length);
    expect(validate(signUpRules, { ...valid, inviteCode })).toEqual(
      length === 6 ? {} : { inviteCode: INVITE },
    );
  }
});

test('every failing field has its message', () => {
  expect(
    validate(signUpRules, {
      email: 'ada',
      password: 'short',
      age: 9,
      inviteCode: 'x',
    }),
  ).toEqual({ email: EMAIL, password: PASSWORD, age: AGE, inviteCode: INVITE });
  for (let age = 0; age <= 30; age += 1) {
    expect(validate(signUpRules, { ...valid, age })).toEqual(
      age < 13 ? { age: AGE } : {},
    );
  }
});

test('validate runs any set of rules', () => {
  type Task = { title: string; done?: boolean };
  const taskRules: Rules<Task> = {
    title: (title) => (title.trim() === '' ? 'Give the task a title.' : null),
    done: (done) => (done === undefined ? 'Say whether it is done.' : null),
  };
  expect(validate(taskRules, { title: 'Tea', done: false })).toEqual({});
  expect(validate(taskRules, { title: ' ' })).toEqual({
    title: 'Give the task a title.',
    done: 'Say whether it is done.',
  });
});

export { noInvite, extra, textAge };

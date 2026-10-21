import { toProfile, type Account } from './index';

const ada: Account = {
  kind: 'person',
  id: 1,
  name: 'Ada',
  email: 'ada@example.com',
  passwordHash: 'hash-ada',
};
const grace: Account = {
  kind: 'person',
  id: 3,
  name: 'Grace',
  email: 'grace@example.com',
  passwordHash: 'hash-grace',
};
const helper: Account = {
  kind: 'bot',
  id: 2,
  name: 'Helper',
  owner: 'Ada',
  apiToken: 'token-helper',
};

test('a person profile has only kind, id and name', () => {
  expect(toProfile(ada)).toEqual({ kind: 'person', id: 1, name: 'Ada' });
});

test('each person gets their own profile', () => {
  expect(toProfile(grace)).toEqual({ kind: 'person', id: 3, name: 'Grace' });
});

test('a bot profile keeps its owner', () => {
  expect(toProfile(helper)).toEqual({
    kind: 'bot',
    id: 2,
    name: 'Helper',
    owner: 'Ada',
  });
});

test('no secret reaches the JSON', () => {
  const json = JSON.stringify([ada, grace, helper].map(toProfile));
  expect(json).not.toContain('@example.com');
  expect(json).not.toContain('hash-');
  expect(json).not.toContain('token-');
});

test('twenty generated accounts each get exactly their own profile', () => {
  for (let i = 0; i < 20; i++) {
    const id = 1000 + i * 7;
    const name = `user-${i}-${(i * 37) % 11}`;
    const account: Account =
      i % 3 === 0
        ? {
            kind: 'bot',
            id,
            name,
            owner: `owner-${i}`,
            apiToken: `secret-token-${i}`,
          }
        : {
            kind: 'person',
            id,
            name,
            email: `${name}@mail.test`,
            passwordHash: `secret-hash-${i}`,
          };
    const expected =
      account.kind === 'bot'
        ? { kind: 'bot', id, name, owner: account.owner }
        : { kind: 'person', id, name };
    const profile = toProfile(account);
    expect(profile).toEqual(expected);
    const json = JSON.stringify(profile);
    expect(json).not.toContain('secret-');
    expect(json).not.toContain('@mail.test');
  }
});

test('the account itself stays as it was', () => {
  toProfile(ada);
  expect(ada).toEqual({
    kind: 'person',
    id: 1,
    name: 'Ada',
    email: 'ada@example.com',
    passwordHash: 'hash-ada',
  });
});

import type { Equal, Expect } from '@dojo/type-utils';
import {
  createToken,
  openAll,
  Session,
  type SessionArgs,
  type Token,
} from './index';

type cases = [
  Expect<
    Equal<Token, { userId: number; scope: 'read' | 'write'; value: string }>
  >, // a token is what createToken returns
  Expect<Equal<SessionArgs, [token: Token, ttlMinutes?: number]>>, // the arguments of new Session
];

// @ts-expect-error
const noToken: SessionArgs = []; // a session needs its token

// @ts-expect-error
const textTtl: SessionArgs = [createToken(1, 'read'), '30']; // the ttl is a number

// @ts-expect-error
const tooMany: SessionArgs = [createToken(1, 'read'), 30, true]; // Session takes two arguments

// @ts-expect-error
const admin: Token = { userId: 1, scope: 'admin', value: 'admin-1' }; // admin is not a scope

test('openAll opens one session per argument list, in order', () => {
  const sessions = openAll([
    [createToken(1, 'read')],
    [createToken(2, 'write'), 90],
  ]);
  expect(sessions).toHaveLength(2);
  expect(sessions[0]).toBeInstanceOf(Session);
  expect(sessions[0].token).toEqual({
    userId: 1,
    scope: 'read',
    value: 'read-1',
  });
  expect(sessions[0].ttlMinutes).toBe(30);
  expect(sessions[1].token).toEqual({
    userId: 2,
    scope: 'write',
    value: 'write-2',
  });
  expect(sessions[1].ttlMinutes).toBe(90);
});

test('openAll keeps every token and ttl it is given', () => {
  const list: SessionArgs[] = [];
  for (let id = 1; id <= 20; id += 1) {
    list.push([createToken(id, id % 2 === 0 ? 'write' : 'read'), id * 5]);
  }
  const sessions = openAll(list);
  sessions.forEach((session, index) => {
    const id = index + 1;
    expect(session.token.userId).toBe(id);
    expect(session.ttlMinutes).toBe(id * 5);
    expect(session.canWrite()).toBe(id % 2 === 0);
  });
});

test('openAll of no argument lists is an empty list', () => {
  expect(openAll([])).toEqual([]);
});

export { noToken, textTtl, tooMany, admin };

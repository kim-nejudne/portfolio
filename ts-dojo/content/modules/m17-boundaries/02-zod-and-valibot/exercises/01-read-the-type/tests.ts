import type { Equal, Expect } from '@dojo/type-utils';
import type { z } from 'zod';
import { greet, UserSchema, type User } from './index';

type cases = [
  Expect<Equal<User, z.infer<typeof UserSchema>>>, // User comes from the schema
  Expect<
    Equal<User, { name: string; age: number; email?: string | undefined }>
  >, // the user's shape
];

test('greet greets a user', () => {
  expect(greet({ name: 'Ada', age: 36 })).toBe('Hello, Ada');
  expect(greet({ name: 'Ada', age: 36, email: 'ada@example.com' })).toBe(
    'Hello, Ada <ada@example.com>',
  );
});

test('greet greets generated users', () => {
  for (let i = 1; i <= 12; i++) {
    const name = `Reader ${i * 7}`;
    expect(greet({ name, age: i })).toBe(`Hello, ${name}`);
    expect(greet({ name, age: i, email: `r${i}@example.org` })).toBe(
      `Hello, ${name} <r${i}@example.org>`,
    );
  }
});

test('greet reports the first issue of anything else', () => {
  expect(greet({ name: 'Ada', age: 36, email: 'ada' })).toBe(
    'Not a user: Invalid email address',
  );
  expect(greet({ name: 'Ada', age: 36.5 })).toBe(
    'Not a user: Invalid input: expected int, received number',
  );
  expect(greet({ name: '', age: 36 })).toBe(
    'Not a user: Too small: expected string to have >=1 characters',
  );
  expect(greet({ age: 36 })).toBe(
    'Not a user: Invalid input: expected string, received undefined',
  );
  expect(greet(null)).toBe(
    'Not a user: Invalid input: expected object, received null',
  );
});

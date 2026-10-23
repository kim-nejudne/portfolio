import { findUser, greet, isBanned, users } from './index';

test('findUser resolves to the user with that id', async () => {
  for (const user of users) {
    await expect(findUser(user.id)).resolves.toBe(user);
  }
});

test('findUser resolves to undefined for an unknown id', async () => {
  await expect(findUser(99)).resolves.toBeUndefined();
});

test('greet says hello to every user who is not banned', async () => {
  for (const user of users.filter((user) => !user.banned)) {
    await expect(greet(user.id)).resolves.toBe(`Hello, ${user.name}`);
  }
});

test('greet denies access to every banned user', async () => {
  for (const user of users.filter((user) => user.banned)) {
    await expect(greet(user.id)).resolves.toBe('Access denied');
  }
});

test('greet does not know an id that has no user', async () => {
  for (const id of [0, 6, 42, -1]) {
    await expect(greet(id)).resolves.toBe('Who are you?');
  }
});

test('isBanned still resolves to a boolean', async () => {
  await expect(isBanned(3)).resolves.toBe(true);
  await expect(isBanned(1)).resolves.toBe(false);
  await expect(isBanned(99)).resolves.toBe(false);
});

test('greet knows the five users by name', async () => {
  expect(users).toHaveLength(5);
  await expect(greet(1)).resolves.toBe('Hello, Ada');
  await expect(greet(2)).resolves.toBe('Hello, Grace');
  await expect(greet(3)).resolves.toBe('Access denied');
  await expect(greet(4)).resolves.toBe('Hello, Linus');
  await expect(greet(5)).resolves.toBe('Access denied');
});

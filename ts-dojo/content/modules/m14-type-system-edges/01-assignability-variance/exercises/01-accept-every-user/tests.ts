import { notifier, type Admin, type Notifier, type User } from './index';

const ada: User = { id: 'u1', name: 'Ada' };
const grace: Admin = { id: 'a1', name: 'Grace', permissions: ['deploy'] };
const linus: Admin = {
  id: 'a2',
  name: 'Linus',
  permissions: ['deploy', 'billing'],
};

// Notifier keeps checking its parameter: a function that only takes admins is not a Notifier.
// @ts-expect-error
const adminsOnly: Notifier = { send: (admin: Admin) => admin.name }; // admins only

test('a plain user gets their name and the message', () => {
  expect(notifier.send(ada, 'hello')).toBe('Ada: hello');
  expect(notifier.send({ id: 'u2', name: 'Alan' }, 'build is green')).toBe(
    'Alan: build is green',
  );
});

test('an admin also gets their permissions', () => {
  expect(notifier.send(grace, 'hello')).toBe('Grace [deploy]: hello');
  expect(notifier.send(linus, 'invoice due')).toBe(
    'Linus [deploy, billing]: invoice due',
  );
});

test('an admin passed as a User is still an admin', () => {
  const asUser: User = linus;
  expect(notifier.send(asUser, 'hi')).toBe('Linus [deploy, billing]: hi');
});

test('an admin with no permissions yet', () => {
  const barbara: Admin = { id: 'a3', name: 'Barbara', permissions: [] };
  expect(notifier.send(barbara, 'hi')).toBe('Barbara []: hi');
});

export { adminsOnly };

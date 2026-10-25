import { canEdit, type Admin, type User } from './index';

const admin: Admin = {
  id: 'u1',
  name: 'Kim',
  role: 'admin',
  permissions: ['delete'],
};
const member: User = { id: 'u2', name: 'Ada', role: 'member' };
const guest: User = { id: 'u3', name: 'Alan', role: 'guest' };
const everyone: User[] = [admin, member, guest];

test('an admin can edit', () => {
  expect(canEdit(admin)).toBe(true);
});

test('a member can edit', () => {
  expect(canEdit(member)).toBe(true);
});

test('a guest cannot edit', () => {
  expect(canEdit(guest)).toBe(false);
});

test('two of the three users can edit', () => {
  expect(everyone.filter(canEdit)).toHaveLength(2);
});

// @ts-expect-error
const notAdmin: Admin = { ...admin, role: 'member' }; // an admin's role is always 'admin'

// @ts-expect-error
const owner: User = { ...member, role: 'owner' }; // 'owner' is not one of the known roles

export { notAdmin, owner };

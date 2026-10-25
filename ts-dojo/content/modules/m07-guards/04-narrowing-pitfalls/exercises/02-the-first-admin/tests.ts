import { firstAdmin, type Member } from './index';

const member = (name: string, role: Member['role'], active = true): Member => ({
  name,
  role,
  active,
});

test('firstAdmin names the only admin', () => {
  expect(firstAdmin([member('ada', 'admin')])).toBe('ada');
  expect(firstAdmin([member('alan', 'viewer'), member('grace', 'admin')])).toBe(
    'grace',
  );
});

test('firstAdmin names the first of several admins', () => {
  for (let i = 0; i < 6; i++) {
    const members = [
      member('viewer', 'viewer'),
      member(`admin${i}`, 'admin'),
      member(`admin${i + 1}`, 'admin'),
    ];
    expect(firstAdmin(members)).toBe(`admin${i}`);
  }
});

test('firstAdmin skips admins who are not active', () => {
  expect(
    firstAdmin([
      member('ada', 'admin', false),
      member('alan', 'editor'),
      member('grace', 'admin'),
    ]),
  ).toBe('grace');
});

test('firstAdmin is nobody when no active admin exists', () => {
  expect(firstAdmin([])).toBe('nobody');
  expect(
    firstAdmin([member('alan', 'editor'), member('ada', 'admin', false)]),
  ).toBe('nobody');
});

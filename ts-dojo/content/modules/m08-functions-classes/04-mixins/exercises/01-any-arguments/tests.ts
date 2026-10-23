import type { Equal, Expect } from '@dojo/type-utils';
import { Activatable, ActivatableUser, User } from './index';

class Task {
  constructor(
    readonly title: string,
    readonly due: number,
  ) {}
}

const ActivatableTask = Activatable(Task);

type cases = [
  Expect<Equal<ConstructorParameters<typeof ActivatableUser>, [name: string]>>, // takes User's arguments
  Expect<
    Equal<
      ConstructorParameters<typeof ActivatableTask>,
      [title: string, due: number]
    >
  >, // and Task's
  Expect<Equal<InstanceType<typeof ActivatableUser>['name'], string>>, // keeps User's members
  Expect<Equal<InstanceType<typeof ActivatableTask>['due'], number>>, // and Task's
  Expect<Equal<InstanceType<typeof ActivatableTask>['active'], boolean>>, // and adds active
];

// @ts-expect-error
const wrongArgument = () => new ActivatableUser(42); // a name is a string

// @ts-expect-error
const missingArgument = () => new ActivatableTask('Report'); // a task needs a due date

test('a new user is inactive and keeps its name', () => {
  const ada = new ActivatableUser('Ada');
  expect(ada.name).toBe('Ada');
  expect(ada.active).toBe(false);
});

test('activate and deactivate switch active', () => {
  const ada = new ActivatableUser('Ada');
  ada.activate();
  expect(ada.active).toBe(true);
  ada.activate();
  expect(ada.active).toBe(true);
  ada.deactivate();
  expect(ada.active).toBe(false);
});

test('the mixin works on any class', () => {
  const report = new ActivatableTask('Report', 5);
  expect(report.title).toBe('Report');
  expect(report.due).toBe(5);
  report.activate();
  expect(report.active).toBe(true);
});

test('each instance has its own state', () => {
  const a = new ActivatableUser('a');
  const b = new ActivatableUser('b');
  a.activate();
  expect(a.active).toBe(true);
  expect(b.active).toBe(false);
});

test('the result extends the class passed in', () => {
  expect(new ActivatableUser('Ada')).toBeInstanceOf(User);
  expect(new ActivatableTask('Report', 1)).toBeInstanceOf(Task);
});

export { wrongArgument, missingArgument };

import type { Equal, Expect } from '@dojo/type-utils';
import {
  dirtyKeys,
  displayName,
  field,
  newProfile,
  type Field,
  type Form,
  type Profile,
} from './index';

type Task = { title: string; done: boolean; readonly due?: Date };

type cases = [
  Expect<
    Equal<
      Form<Profile>,
      {
        readonly id: Field<number>;
        name: Field<string>;
        bio?: Field<string | undefined>;
      }
    >
  >, // one field per property, with its type and modifiers
  Expect<
    Equal<
      Form<Task>,
      {
        title: Field<string>;
        done: Field<boolean>;
        readonly due?: Field<Date | undefined>;
      }
    >
  >, // works for any type
];

// @ts-expect-error
const noName: Form<Profile> = { id: field(1) }; // name is required

// @ts-expect-error
const textId: Form<Profile> = { id: field('1'), name: field('') }; // an id is a number

// @ts-expect-error
const setId = (form: Form<Profile>) => (form.id = field(2)); // id is read-only

test('newProfile leaves the optional bio out', () => {
  expect(Object.keys(newProfile)).toEqual(['id', 'name']);
  expect(newProfile.id).toEqual({ value: 0, dirty: false });
  expect(newProfile.name).toEqual({ value: '', dirty: false });
});

test('displayName trims the name, or falls back to Anonymous', () => {
  expect(displayName(newProfile)).toBe('Anonymous');
  const named: Form<Profile> = { id: field(1), name: field('  Ada  ') };
  expect(displayName(named)).toBe('Ada');
  const blank: Form<Profile> = { id: field(2), name: field('   ') };
  expect(displayName(blank)).toBe('Anonymous');
});

test('dirtyKeys lists the changed fields of any form', () => {
  expect(dirtyKeys(newProfile)).toEqual([]);
  const edited: Form<Profile> = {
    id: field(3),
    name: { value: 'Grace', dirty: true },
    bio: { value: 'Admiral', dirty: true },
  };
  expect(dirtyKeys(edited)).toEqual(['name', 'bio']);
  const task: Form<Task> = {
    title: field('Tea'),
    done: { value: true, dirty: true },
  };
  expect(dirtyKeys(task)).toEqual(['done']);
});

export { noName, textId, setId };

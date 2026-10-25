import type { Equal, Expect } from '@dojo/type-utils';
import { createCli, dojo, type Cli } from './index';

const git = createCli(
  { status: () => 'clean', log: () => 'F13: content wave 3' },
  'log',
);

const anyCommands = <K extends string>(
  commands: Record<K, () => string>,
  fallback: K,
) => createCli(commands, fallback);

type cases = [
  Expect<Equal<typeof dojo, Cli<'help' | 'version' | 'lessons'>>>, // the names are the keys
  Expect<Equal<typeof git, Cli<'status' | 'log'>>>, // another record, other names
  Expect<Equal<ReturnType<typeof anyCommands<'a' | 'b'>>, Cli<'a' | 'b'>>>, // any commands at all
];

// @ts-expect-error
const typo = () => createCli({ help: () => 'usage' }, 'hepl'); // a fallback that is no command

// @ts-expect-error
const missing = () => createCli({ status: () => 'clean' }, 'log'); // log is not in this record

export { anyCommands, typo, missing };

test('runs the named command', () => {
  expect(dojo.run('help')).toBe('usage: dojo <command>');
  expect(dojo.run('version')).toBe('1.0.0');
  expect(dojo.run('lessons')).toBe('62 lessons');
  expect(git.run('status')).toBe('clean');
});

test('runs the fallback for any other name', () => {
  expect(dojo.run('upgrade')).toBe('usage: dojo <command>');
  expect(dojo.run('')).toBe('usage: dojo <command>');
  expect(git.run('push')).toBe('F13: content wave 3');
});

test('has knows the commands', () => {
  expect(dojo.has('version')).toBe(true);
  expect(git.has('log')).toBe(true);
  expect(dojo.has('upgrade')).toBe(false);
  expect(git.has('help')).toBe(false);
});

test('what every object has is no command', () => {
  expect(dojo.has('toString')).toBe(false);
  expect(dojo.has('constructor')).toBe(false);
  expect(dojo.run('toString')).toBe('usage: dojo <command>');
  expect(git.run('hasOwnProperty')).toBe('F13: content wave 3');
});

import type { Equal, Expect } from '@dojo/type-utils';
import {
  SHORTCUTS,
  actionsByScope,
  keysFor,
  type Action,
  type Scope,
  type Shortcut,
} from './index';

type cases = [
  Expect<
    Equal<
      Action,
      | 'open-roadmap'
      | 'open-settings'
      | 'show-help'
      | 'next-diagnostic'
      | 'previous-diagnostic'
      | 'show-hover'
    >
  >, // Action is every action in SHORTCUTS
  Expect<Equal<Scope, 'global' | 'editor'>>, // Scope is every scope in SHORTCUTS
  Expect<Equal<Shortcut['action'], Action>>, // a shortcut's action is an Action
  Expect<Equal<Shortcut['keys'], 'g r' | 'g s' | '?' | ']d' | '[d' | 'K'>>, // a shortcut's keys are the listed keys
];

const help: Shortcut = SHORTCUTS[2];

// @ts-expect-error
const quit = keysFor(SHORTCUTS, 'quit'); // quit is not an action

// @ts-expect-error
const mixed: Shortcut = { keys: 'g r', action: 'show-help', scope: 'global' }; // no shortcut pairs g r with show-help

// @ts-expect-error
const modal: Scope = 'modal'; // modal is not a scope

const editorOnly = SHORTCUTS.filter((shortcut) => shortcut.scope === 'editor');
const globalOnly = SHORTCUTS.filter((shortcut) => shortcut.scope === 'global');

test('keysFor finds the keys of every action', () => {
  for (const shortcut of SHORTCUTS) {
    expect(keysFor(SHORTCUTS, shortcut.action)).toBe(shortcut.keys);
  }
  expect(keysFor(SHORTCUTS, 'show-help')).toBe('?');
});

test('keysFor searches the list it is given', () => {
  expect(keysFor(editorOnly, 'show-help')).toBeUndefined();
  expect(keysFor(editorOnly, 'show-hover')).toBe('K');
  expect(keysFor(globalOnly, 'next-diagnostic')).toBeUndefined();
  expect(keysFor(globalOnly, 'open-settings')).toBe('g s');
  expect(keysFor([help], 'show-help')).toBe('?');
});

test('keysFor of an empty list is undefined', () => {
  expect(keysFor([], 'open-roadmap')).toBeUndefined();
});

test('actionsByScope groups every shortcut', () => {
  expect(actionsByScope(SHORTCUTS)).toEqual({
    global: ['open-roadmap', 'open-settings', 'show-help'],
    editor: ['next-diagnostic', 'previous-diagnostic', 'show-hover'],
  });
});

test('actionsByScope keeps the order of the list', () => {
  expect(actionsByScope([...SHORTCUTS].reverse())).toEqual({
    global: ['show-help', 'open-settings', 'open-roadmap'],
    editor: ['show-hover', 'previous-diagnostic', 'next-diagnostic'],
  });
});

test('actionsByScope gives an empty group to a scope with no shortcuts', () => {
  expect(actionsByScope(editorOnly)).toEqual({
    global: [],
    editor: ['next-diagnostic', 'previous-diagnostic', 'show-hover'],
  });
  expect(actionsByScope([help])).toEqual({ global: ['show-help'], editor: [] });
  expect(actionsByScope([])).toEqual({ global: [], editor: [] });
});

test('actionsByScope builds new groups on every call', () => {
  const first = actionsByScope(SHORTCUTS);
  first.global.push('show-hover');
  expect(actionsByScope(SHORTCUTS).global).toEqual([
    'open-roadmap',
    'open-settings',
    'show-help',
  ]);
});

export { quit, mixed, modal };

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  REVIEW_KEYS,
  formAction,
  isTyping,
  reviewAction,
  saveHint,
  stepCard,
  type KeyLike,
} from './reviewKeys.js';

const press = (key: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe('reviewAction', () => {
  it.each([
    ['j', 'next'],
    ['ArrowDown', 'next'],
    ['k', 'prev'],
    ['ArrowUp', 'prev'],
    ['e', 'edit'],
    ['r', 'replace'],
    ['p', 'preview'],
  ] as const)('%s is %s', (key, action) => {
    expect(reviewAction(press(key))).toBe(action);
  });

  it('Shift+M marks the level reviewed, and m alone does nothing', () => {
    expect(reviewAction(press('M', { shiftKey: true }))).toBe('mark');
    expect(reviewAction(press('m'))).toBeNull();
  });

  it('a letter with Shift is not its plain shortcut', () => {
    expect(reviewAction(press('E', { shiftKey: true }))).toBeNull();
    expect(reviewAction(press('J', { shiftKey: true }))).toBeNull();
  });

  it('Caps Lock letters still act', () => {
    expect(reviewAction(press('E'))).toBe('edit');
  });

  it('leaves Ctrl, ⌘ and Alt combinations to the browser', () => {
    expect(reviewAction(press('r', { ctrlKey: true }))).toBeNull();
    expect(reviewAction(press('p', { metaKey: true }))).toBeNull();
    expect(reviewAction(press('j', { altKey: true }))).toBeNull();
    expect(reviewAction(press('M', { shiftKey: true, ctrlKey: true }))).toBeNull();
  });

  it('only moving acts again while a key is held', () => {
    expect(reviewAction(press('j', { repeat: true }))).toBe('next');
    expect(reviewAction(press('ArrowUp', { repeat: true }))).toBe('prev');
    expect(reviewAction(press('e', { repeat: true }))).toBeNull();
    expect(reviewAction(press('M', { shiftKey: true, repeat: true }))).toBeNull();
  });

  it('other keys are not shortcuts', () => {
    for (const key of ['x', 'Enter', 'Escape', ' ', 'ArrowLeft', 'Tab']) {
      expect(reviewAction(press(key))).toBeNull();
    }
  });

  it('every action has a hint and aria-keyshortcuts naming its keys', () => {
    for (const def of Object.values(REVIEW_KEYS)) {
      expect(def.hint).not.toBe('');
      expect(def.aria).not.toBe('');
    }
  });
});

describe('formAction', () => {
  it('Ctrl+Enter or ⌘+Enter saves', () => {
    expect(formAction(press('Enter', { ctrlKey: true }))).toBe('save');
    expect(formAction(press('Enter', { metaKey: true }))).toBe('save');
  });

  it('Esc cancels', () => {
    expect(formAction(press('Escape'))).toBe('cancel');
  });

  it('a plain Enter, a held key and other modifiers do nothing', () => {
    expect(formAction(press('Enter'))).toBeNull();
    expect(formAction(press('Enter', { ctrlKey: true, repeat: true }))).toBeNull();
    expect(formAction(press('Enter', { ctrlKey: true, altKey: true }))).toBeNull();
    expect(formAction(press('Enter', { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(formAction(press('Escape', { shiftKey: true }))).toBeNull();
    expect(formAction(press('e'))).toBeNull();
  });
});

describe('saveHint', () => {
  it('shows ⌘ on Apple platforms and Ctrl elsewhere', () => {
    expect(saveHint('MacIntel')).toBe('⌘+Enter');
    expect(saveHint('iPad')).toBe('⌘+Enter');
    expect(saveHint('Win32')).toBe('Ctrl+Enter');
    expect(saveHint('Linux x86_64')).toBe('Ctrl+Enter');
    expect(saveHint('')).toBe('Ctrl+Enter');
  });
});

describe('isTyping', () => {
  it('is true in inputs, text areas, selects and editable text', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    // jsdom does not compute isContentEditable.
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    for (const el of [
      document.createElement('input'),
      document.createElement('textarea'),
      document.createElement('select'),
      editable,
    ]) {
      expect(isTyping(el)).toBe(true);
    }
  });

  it('is false on buttons, articles, the body and nothing', () => {
    expect(isTyping(document.createElement('button'))).toBe(false);
    expect(isTyping(document.createElement('article'))).toBe(false);
    expect(isTyping(document.body)).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});

describe('stepCard', () => {
  it('with no card focused, next goes to the first and previous to the last', () => {
    expect(stepCard(-1, 4, 1)).toBe(0);
    expect(stepCard(-1, 4, -1)).toBe(3);
  });

  it('moves one card and stops at either end', () => {
    expect(stepCard(1, 4, 1)).toBe(2);
    expect(stepCard(1, 4, -1)).toBe(0);
    expect(stepCard(3, 4, 1)).toBe(3);
    expect(stepCard(0, 4, -1)).toBe(0);
  });

  it('is null with no cards, and treats a stale index as none', () => {
    expect(stepCard(-1, 0, 1)).toBeNull();
    expect(stepCard(5, 3, 1)).toBe(0);
  });
});

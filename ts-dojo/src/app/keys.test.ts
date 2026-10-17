// The global keyboard map (spec §6 Global keys) as pure functions: which key fires which app
// action, and the conflict rule that nothing fires from an editable target or the editor.
import { describe, expect, it } from 'vitest';
import { GLOBAL_KEYS, isEditableTarget, matchGlobalKey } from './keys.ts';

describe('matchGlobalKey (§6)', () => {
  const action = (
    key: string,
    extra: object = {},
    prefix: Parameters<typeof matchGlobalKey>[1] = null,
  ) => matchGlobalKey({ key, ...extra }, prefix);

  it('? opens the help overlay', () => {
    expect(action('?')).toEqual({ kind: 'action', action: 'help' });
    expect(action('?', { shiftKey: true })).toEqual({
      kind: 'action',
      action: 'help',
    });
  });

  it('? with Ctrl, Alt or Meta is not the global key', () => {
    expect(action('?', { ctrlKey: true })).toEqual({ kind: 'none' });
    expect(action('?', { altKey: true })).toEqual({ kind: 'none' });
    expect(action('?', { metaKey: true })).toEqual({ kind: 'none' });
  });

  it('Ctrl-p opens the command palette; Ctrl-Shift-p and plain p do not', () => {
    expect(action('p', { ctrlKey: true })).toEqual({
      kind: 'action',
      action: 'palette',
    });
    expect(action('p', { ctrlKey: true, shiftKey: true })).toEqual({
      kind: 'none',
    });
    expect(action('p')).toEqual({ kind: 'none' });
    expect(action('p', { ctrlKey: true, altKey: true })).toEqual({
      kind: 'none',
    });
  });

  it('g, ] and [ start a sequence that the second key completes', () => {
    expect(action('g')).toEqual({ kind: 'prefix', prefix: 'g' });
    expect(action(']')).toEqual({ kind: 'prefix', prefix: ']' });
    expect(action('[')).toEqual({ kind: 'prefix', prefix: '[' });
    expect(action('r', {}, 'g')).toEqual({ kind: 'action', action: 'roadmap' });
    expect(action('n', {}, 'g')).toEqual({
      kind: 'action',
      action: 'lessonNext',
    });
    expect(action('p', {}, 'g')).toEqual({
      kind: 'action',
      action: 'lessonPrev',
    });
    expect(action('e', {}, ']')).toEqual({
      kind: 'action',
      action: 'exerciseNext',
    });
    expect(action('e', {}, '[')).toEqual({
      kind: 'action',
      action: 'exercisePrev',
    });
  });

  it('a second key that completes no sequence drops the prefix and does nothing', () => {
    expect(action('x', {}, 'g')).toEqual({ kind: 'none' });
    expect(action('g', {}, 'g')).toEqual({ kind: 'none' });
    expect(action('?', {}, 'g')).toEqual({ kind: 'none' });
    expect(action('r', {}, ']')).toEqual({ kind: 'none' });
  });

  it('other keys map to nothing (the pane keys are F8)', () => {
    for (const key of ['/', 'a', 'Escape', 'Enter', 'j', '1', 'r', 'n', 'e']) {
      expect(action(key), key).toEqual({ kind: 'none' });
    }
  });
});

describe('isEditableTarget (§6 conflict rule)', () => {
  const element = (
    tagName: string,
    extra: { isContentEditable?: boolean; inEditor?: boolean } = {},
  ) => ({
    tagName,
    isContentEditable: extra.isContentEditable ?? false,
    closest: (selector: string) =>
      selector === '.cm-editor' && extra.inEditor === true ? {} : null,
  });

  it('is true for inputs, textareas, selects, contenteditable and anything inside the editor', () => {
    expect(isEditableTarget(element('INPUT'))).toBe(true);
    expect(isEditableTarget(element('TEXTAREA'))).toBe(true);
    expect(isEditableTarget(element('SELECT'))).toBe(true);
    expect(isEditableTarget(element('DIV', { isContentEditable: true }))).toBe(
      true,
    );
    expect(isEditableTarget(element('SPAN', { inEditor: true }))).toBe(true);
  });

  it('is false for the body, a plain element, a button, or no target', () => {
    expect(isEditableTarget(element('BODY'))).toBe(false);
    expect(isEditableTarget(element('DIV'))).toBe(false);
    expect(isEditableTarget(element('BUTTON'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(undefined)).toBe(false);
  });
});

describe('GLOBAL_KEYS (the §6 table, shown in the help overlay)', () => {
  it('lists every §6 row in order', () => {
    expect(GLOBAL_KEYS.map((row) => row.keys)).toEqual([
      '?',
      'Ctrl-p',
      'g r',
      'g n / g p',
      '] e / [ e',
      'Ctrl-h j k l',
      '1 2 3',
      'Esc',
      'j k gg G Ctrl-d Ctrl-u',
      'Enter',
    ]);
    for (const row of GLOBAL_KEYS) expect(row.action.length).toBeGreaterThan(0);
  });
});

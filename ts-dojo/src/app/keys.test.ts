// The global keyboard map (spec §6 Global keys) as pure functions: which key fires which app
// action, and the conflict rule that nothing fires from an editable target or the editor.
import { describe, expect, it } from 'vitest';
import { GLOBAL_KEYS, isEditableTarget, matchGlobalKey } from './keys.ts';

describe('matchGlobalKey (§6)', () => {
  it('? opens the help overlay', () => {
    expect(matchGlobalKey({ key: '?' })).toBe('help');
    expect(matchGlobalKey({ key: '?', shiftKey: true })).toBe('help');
  });

  it('? with Ctrl, Alt or Meta is not the global key', () => {
    expect(matchGlobalKey({ key: '?', ctrlKey: true })).toBeNull();
    expect(matchGlobalKey({ key: '?', altKey: true })).toBeNull();
    expect(matchGlobalKey({ key: '?', metaKey: true })).toBeNull();
  });

  it('other keys map to nothing yet', () => {
    for (const key of ['/', 'a', 'Escape', 'Enter', 'j', 'g']) {
      expect(matchGlobalKey({ key }), key).toBeNull();
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

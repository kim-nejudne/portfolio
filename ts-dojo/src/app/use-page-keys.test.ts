// The guards on a page's own keys (§6 conflict rule): a key reaches the roadmap or the module
// page only outside text fields, the editor and dialogs, without Ctrl/Alt/Meta, and when no
// one handled it already.
import { describe, expect, it } from 'vitest';
import { pageKeyOf } from './use-page-keys';

const body = { tagName: 'BODY', closest: () => null };
const inside = (selector: string) => ({
  tagName: 'DIV',
  closest: (s: string) => (s.includes(selector) ? {} : null),
});

describe('pageKeyOf', () => {
  it('passes a plain key pressed on the page', () => {
    expect(pageKeyOf({ key: 'j' }, body)).toBe('j');
    expect(pageKeyOf({ key: 'c' }, null)).toBe('c');
  });

  it('drops a key with a modifier, or one already handled', () => {
    expect(pageKeyOf({ key: 'j', ctrlKey: true }, body)).toBeNull();
    expect(pageKeyOf({ key: 'j', altKey: true }, body)).toBeNull();
    expect(pageKeyOf({ key: 'j', metaKey: true }, body)).toBeNull();
    expect(pageKeyOf({ key: 'j', defaultPrevented: true }, body)).toBeNull();
  });

  it('drops a key typed in a field, in the editor or in a dialog', () => {
    expect(pageKeyOf({ key: 'j' }, { tagName: 'INPUT' })).toBeNull();
    expect(pageKeyOf({ key: 'j' }, inside('.cm-editor'))).toBeNull();
    expect(pageKeyOf({ key: 'j' }, inside('[role="dialog"]'))).toBeNull();
  });
});

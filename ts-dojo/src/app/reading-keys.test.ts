// §6 Global keys: "`j k gg G Ctrl-d Ctrl-u` Scroll the focused reading pane". The key → scroll
// mapping, with `gg` as a two-key sequence.
import { describe, expect, it } from 'vitest';
import { LINE_PX, readingKey, scrollTarget } from './reading-keys';

describe('readingKey', () => {
  it('maps the six scrolling keys, gg after a pending g', () => {
    expect(readingKey({ key: 'j' }, false)).toBe('down');
    expect(readingKey({ key: 'k' }, false)).toBe('up');
    expect(readingKey({ key: 'G', shiftKey: true }, false)).toBe('bottom');
    expect(readingKey({ key: 'd', ctrlKey: true }, false)).toBe('halfDown');
    expect(readingKey({ key: 'u', ctrlKey: true }, false)).toBe('halfUp');
    expect(readingKey({ key: 'g' }, false)).toBe('pendingG');
    expect(readingKey({ key: 'g' }, true)).toBe('top');
    expect(readingKey({ key: 'x' }, false)).toBeNull();
    expect(readingKey({ key: 'j', altKey: true }, false)).toBeNull();
    expect(readingKey({ key: 'h', ctrlKey: true }, false)).toBeNull();
  });
});

describe('scrollTarget', () => {
  const pane = { scrollTop: 500, scrollHeight: 3000, clientHeight: 800 };
  it('scrolls by a line, half a page, or to an end, clamped', () => {
    expect(scrollTarget('down', pane)).toBe(500 + LINE_PX);
    expect(scrollTarget('up', pane)).toBe(500 - LINE_PX);
    expect(scrollTarget('halfDown', pane)).toBe(900);
    expect(scrollTarget('halfUp', pane)).toBe(100);
    expect(scrollTarget('top', pane)).toBe(0);
    expect(scrollTarget('bottom', pane)).toBe(2200);
    expect(scrollTarget('halfUp', { ...pane, scrollTop: 100 })).toBe(0);
    expect(scrollTarget('halfDown', { ...pane, scrollTop: 2100 })).toBe(2200);
  });
});

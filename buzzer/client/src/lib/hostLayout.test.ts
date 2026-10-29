// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadReadAloud,
  readAloudRequested,
  saveReadAloud,
  withoutReadAloud,
} from './hostLayout.js';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('read-aloud choice', () => {
  it('is off until saved, per room, and off again once cleared', () => {
    expect(loadReadAloud('WXYZ')).toBe(false);
    saveReadAloud('WXYZ', true);
    expect(loadReadAloud('WXYZ')).toBe(true);
    expect(loadReadAloud('ABCD')).toBe(false);
    saveReadAloud('WXYZ', false);
    expect(loadReadAloud('WXYZ')).toBe(false);
  });

  it('is off, and saving is a no-op, when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveReadAloud('WXYZ', true)).not.toThrow();
    expect(loadReadAloud('WXYZ')).toBe(false);
  });
});

describe('?read=1', () => {
  it.each([
    ['?read=1', true],
    ['?x=2&read=1', true],
    ['?read=0', false],
    ['?read', false],
    ['', false],
  ])('%s requests read aloud: %s', (search, expected) => {
    expect(readAloudRequested(search)).toBe(expected);
  });

  it('is dropped from the search, keeping any other params', () => {
    expect(withoutReadAloud('?read=1')).toBe('');
    expect(withoutReadAloud('?x=2&read=1')).toBe('?x=2');
    expect(withoutReadAloud('')).toBe('');
  });
});

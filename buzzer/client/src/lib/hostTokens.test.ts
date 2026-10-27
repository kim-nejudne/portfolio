// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearHostToken, loadHostToken, saveHostToken, tokenFromHash } from './hostTokens.js';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('host tokens', () => {
  it('stores a token per room code', () => {
    saveHostToken('ABCD', 'token-abcd');
    saveHostToken('WXYZ', 'token-wxyz');
    expect(loadHostToken('ABCD')).toBe('token-abcd');
    expect(loadHostToken('WXYZ')).toBe('token-wxyz');
  });

  it('returns null for a room this device did not create', () => {
    expect(loadHostToken('QRST')).toBeNull();
  });

  it('clears the token of one room only', () => {
    saveHostToken('ABCD', 'token-abcd');
    saveHostToken('WXYZ', 'token-wxyz');
    clearHostToken('ABCD');
    expect(loadHostToken('ABCD')).toBeNull();
    expect(loadHostToken('WXYZ')).toBe('token-wxyz');
  });

  it('does not throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(() => saveHostToken('ABCD', 'token')).not.toThrow();
    expect(() => clearHostToken('ABCD')).not.toThrow();
    expect(loadHostToken('ABCD')).toBeNull();
  });

  it('reads a well-formed token from a pairing link hash', () => {
    const token = 'a1_-'.repeat(10) + 'xyz';
    expect(tokenFromHash(`#t=${token}`)).toBe(token);
  });

  it('ignores a missing or malformed hash token', () => {
    expect(tokenFromHash('')).toBeNull();
    expect(tokenFromHash('#x=1')).toBeNull();
    expect(tokenFromHash('#t=short')).toBeNull();
    expect(tokenFromHash(`#t=${'a'.repeat(42)}!`)).toBeNull();
  });
});

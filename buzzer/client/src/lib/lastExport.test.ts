// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLastExport, saveLastExport } from './lastExport.js';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('last export', () => {
  it('keeps the time of the last Export all', () => {
    expect(loadLastExport()).toBeNull();
    saveLastExport(1_700_000_000_000);
    expect(loadLastExport()).toBe(1_700_000_000_000);
  });

  it('reads a missing, garbled, zero or negative value as never exported', () => {
    for (const stored of ['abc', '0', '-5', '1.5', '']) {
      localStorage.setItem('buzzr:lastExport', stored);
      expect(loadLastExport()).toBeNull();
    }
  });

  it('copes without storage (private mode, blocked site data)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveLastExport(1)).not.toThrow();
    expect(loadLastExport()).toBeNull();
  });
});

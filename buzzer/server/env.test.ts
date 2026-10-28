import { describe, expect, it } from 'vitest';
import { GLOBAL_IMAGES_MAX_BYTES } from '../shared/constants.js';
import { parseImagesMaxBytes, parseTrustProxy } from './env.js';

describe('parseTrustProxy', () => {
  it('is off when unset or empty', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
  });

  it('reads a hop count as a number', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
  });

  it('passes any other value through as an Express trust string', () => {
    expect(parseTrustProxy('loopback')).toBe('loopback');
    expect(parseTrustProxy('10.0.0.0/8, 172.16.0.0/12')).toBe('10.0.0.0/8, 172.16.0.0/12');
  });
});

describe('parseImagesMaxBytes', () => {
  it('defaults to the global image cap when unset or empty', () => {
    expect(parseImagesMaxBytes(undefined)).toBe(GLOBAL_IMAGES_MAX_BYTES);
    expect(parseImagesMaxBytes('')).toBe(GLOBAL_IMAGES_MAX_BYTES);
  });

  it('reads whole megabytes', () => {
    expect(parseImagesMaxBytes('200')).toBe(200 * 1024 * 1024);
    expect(parseImagesMaxBytes('1')).toBe(1024 * 1024);
  });

  it('refuses a value that is not a positive whole number', () => {
    for (const value of ['0', '-5', '1.5', '200MB', 'abc', ' 200']) {
      expect(() => parseImagesMaxBytes(value)).toThrow(/IMAGES_MAX_MB/);
    }
  });

  it('refuses a value above the global image cap', () => {
    expect(parseImagesMaxBytes('500')).toBe(GLOBAL_IMAGES_MAX_BYTES);
    expect(() => parseImagesMaxBytes('501')).toThrow(/IMAGES_MAX_MB/);
  });
});

// `parseTrustProxy` ported from Buzzr (buzzer/server/env.test.ts).
import { describe, expect, it } from 'vitest';
import {
  devToolsEnabled,
  parseAdminPasswordHash,
  parseAdminSetupCode,
  parseDataDir,
  parseGenerationCap,
  parseTrustProxy,
} from './env.js';

describe('parseTrustProxy', () => {
  it('is off when unset or empty', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
  });

  it('reads true and false as booleans, not as address lists', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('false')).toBe(false);
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

describe('devToolsEnabled', () => {
  it('is on only for NODE_ENV=development (npm run dev)', () => {
    expect(devToolsEnabled('development')).toBe(true);
  });

  it('fails closed: production, unset, empty or anything else is off', () => {
    for (const value of ['production', undefined, '', 'prod', 'Development', 'test']) {
      expect(devToolsEnabled(value)).toBe(false);
    }
  });
});

describe('parseDataDir', () => {
  it('defaults to ./.data under the working directory when unset or blank', () => {
    expect(parseDataDir(undefined, '/srv/sketchy')).toBe('/srv/sketchy/.data');
    expect(parseDataDir('', '/srv/sketchy')).toBe('/srv/sketchy/.data');
    expect(parseDataDir('  ', '/srv/sketchy')).toBe('/srv/sketchy/.data');
  });

  it("keeps an absolute path, such as the image's /data", () => {
    expect(parseDataDir('/data', '/app')).toBe('/data');
  });

  it('resolves a relative path against the working directory', () => {
    expect(parseDataDir('tmp/store', '/srv/sketchy')).toBe('/srv/sketchy/tmp/store');
  });
});

describe('parseAdminSetupCode', () => {
  it('is null when unset or blank, and trims the code', () => {
    expect(parseAdminSetupCode(undefined)).toBeNull();
    expect(parseAdminSetupCode('')).toBeNull();
    expect(parseAdminSetupCode('   ')).toBeNull();
    expect(parseAdminSetupCode('  pencil-moon-42 ')).toBe('pencil-moon-42');
  });
});

describe('parseAdminPasswordHash (ported from Buzzr)', () => {
  const salt = Buffer.alloc(16, 1).toString('base64url');
  const key = Buffer.alloc(32, 2).toString('base64url');

  it('is null when unset or blank', () => {
    expect(parseAdminPasswordHash(undefined)).toBeNull();
    expect(parseAdminPasswordHash(' ')).toBeNull();
  });

  it('reads the costs, salt and key', () => {
    const parsed = parseAdminPasswordHash(`scrypt$32768$8$1$${salt}$${key}`)!;
    expect([parsed.N, parsed.r, parsed.p]).toEqual([32768, 8, 1]);
    expect(parsed.salt).toEqual(Buffer.alloc(16, 1));
    expect(parsed.hash).toEqual(Buffer.alloc(32, 2));
  });

  it.each([
    ['bcrypt$1$2$3$a$b', /6 parts/],
    [`scrypt$1000$8$1$${salt}$${key}`, /power of 2/],
    [`scrypt$x$8$1$${salt}$${key}`, /N must be/],
    [`scrypt$1048576$32$1$${salt}$${key}`, /64 MB/],
    [`scrypt$1024$8$1$not+base64$${key}`, /salt is not base64url/],
    [`scrypt$1024$8$1$${Buffer.alloc(8).toString('base64url')}$${key}`, /salt must be/],
    [`scrypt$1024$8$1$${salt}$${Buffer.alloc(8).toString('base64url')}`, /hash must be/],
  ])('refuses %s', (value, message) => {
    expect(() => parseAdminPasswordHash(value)).toThrow(message);
  });

  it('never quotes the value in its error', () => {
    let message = '';
    try {
      parseAdminPasswordHash(`scrypt$1000$8$1$${salt}$${key}`);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/power of 2/);
    expect(message).not.toContain(key);
  });
});

describe('parseGenerationCap (F84)', () => {
  it('is $5 when unset or blank', () => {
    expect(parseGenerationCap(undefined)).toEqual({ capUsd: 5, warning: null });
    expect(parseGenerationCap('  ')).toEqual({ capUsd: 5, warning: null });
  });

  it('reads whole and decimal dollars, and 0 (generation off)', () => {
    expect(parseGenerationCap('10')).toEqual({ capUsd: 10, warning: null });
    expect(parseGenerationCap(' 2.50 ')).toEqual({ capUsd: 2.5, warning: null });
    expect(parseGenerationCap('0')).toEqual({ capUsd: 0, warning: null });
  });

  it('anything else is $5 with a warning that never quotes the value: a typo never lifts the cap', () => {
    for (const value of ['50x', '-1', 'Infinity', '1e9', '5 USD', 'NaN']) {
      const { capUsd, warning } = parseGenerationCap(value);
      expect(capUsd).toBe(5);
      expect(warning).toContain('SKETCHY_GENERATION_CAP_USD is not a number of dollars');
      expect(warning).not.toContain(value);
    }
  });
});

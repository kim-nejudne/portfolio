// `parseTrustProxy` ported from Buzzr (buzzer/server/env.test.ts).
import { describe, expect, it } from 'vitest';
import { devToolsEnabled, parseDataDir, parseTrustProxy } from './env.js';

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

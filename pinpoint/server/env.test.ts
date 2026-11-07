import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('uses the spec defaults when nothing is set', () => {
    const env = parseEnv({});
    expect(env).toMatchObject({
      production: false,
      port: 3000,
      dataDir: './.data',
      trustProxy: false,
      publicUrl: 'https://pinpoint.kimnejudne.dev',
      adminPasswordHash: null,
      anthropicApiKey: null,
      cartoKey: null,
      wikimediaContact: null,
      generateDailyLimit: 20,
      generateReplaceDailyLimit: 100,
      generateFake: false,
      photosMaxMb: 1024,
    });
  });

  it('defaults DATA_DIR to /app/data in production', () => {
    expect(parseEnv({ NODE_ENV: 'production' }).dataDir).toBe('/app/data');
  });

  it('treats blank values as unset', () => {
    const env = parseEnv({ ADMIN_PASSWORD_HASH: '  ', PINPOINT_CARTO_KEY: '', PORT: '' });
    expect(env.adminPasswordHash).toBeNull();
    expect(env.cartoKey).toBeNull();
    expect(env.port).toBe(3000);
  });

  it('parses TRUST_PROXY as a hop count, a boolean or a trust string', () => {
    expect(parseEnv({ TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(parseEnv({ TRUST_PROXY: 'true' }).trustProxy).toBe(true);
    expect(parseEnv({ TRUST_PROXY: 'loopback' }).trustProxy).toBe('loopback');
  });

  it('reads numbers, the fake switch and a trailing-slash URL', () => {
    const env = parseEnv({
      PORT: '3010',
      GENERATE_DAILY_LIMIT: '5',
      GENERATE_FAKE: '1',
      PUBLIC_URL: 'http://localhost:5180/',
    });
    expect(env.port).toBe(3010);
    expect(env.generateDailyLimit).toBe(5);
    expect(env.generateFake).toBe(true);
    expect(env.publicUrl).toBe('http://localhost:5180');
  });

  it('names the variable when a value is invalid', () => {
    expect(() => parseEnv({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => parseEnv({ PHOTOS_MAX_MB: '0' })).toThrow(/PHOTOS_MAX_MB/);
    expect(() => parseEnv({ PUBLIC_URL: 'not a url' })).toThrow(/PUBLIC_URL/);
  });
});

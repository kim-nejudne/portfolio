import { describe, expect, it } from 'vitest';
import { GLOBAL_IMAGES_MAX_BYTES } from '../shared/constants.js';
import { lanAddress, parseImagesMaxBytes, parsePublicUrl, parseTrustProxy } from './env.js';

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

describe('parsePublicUrl', () => {
  it('is null when unset or empty', () => {
    expect(parsePublicUrl(undefined)).toBeNull();
    expect(parsePublicUrl('')).toBeNull();
  });

  it('reads an http(s) origin, with or without a trailing slash or port', () => {
    expect(parsePublicUrl('https://buzzr.example')).toBe('https://buzzr.example');
    expect(parsePublicUrl('https://buzzr.example/')).toBe('https://buzzr.example');
    expect(parsePublicUrl('http://192.168.1.20:3000')).toBe('http://192.168.1.20:3000');
    expect(parsePublicUrl('HTTPS://Buzzr.Example:443')).toBe('https://buzzr.example');
  });

  it('refuses anything that is not a bare http(s) origin', () => {
    for (const value of [
      'buzzr.example',
      'ftp://buzzr.example',
      'https://buzzr.example/play',
      'https://buzzr.example?x=1',
      'https://buzzr.example#top',
      'https://user:pw@buzzr.example',
      'javascript:alert(1)',
      'not a url',
    ]) {
      expect(() => parsePublicUrl(value)).toThrow(/PUBLIC_URL/);
    }
  });
});

const info = (address: string, family: 'IPv4' | 'IPv6' = 'IPv4', internal = false) =>
  family === 'IPv4'
    ? { address, netmask: '255.255.255.0', family, mac: '', internal, cidr: null }
    : { address, netmask: 'ffff::', family, mac: '', internal, cidr: null, scopeid: 0 };

describe('lanAddress', () => {
  it('returns the first private IPv4 on a real interface', () => {
    expect(
      lanAddress({
        lo: [info('127.0.0.1', 'IPv4', true)],
        enp3s0: [info('fe80::1', 'IPv6'), info('10.0.0.5')],
        wlan0: [info('192.168.1.20')],
      }),
    ).toBe('10.0.0.5');
  });

  it('skips docker*, br-* and veth* interfaces', () => {
    expect(
      lanAddress({
        docker0: [info('172.17.0.1')],
        'br-1a2b3c': [info('172.18.0.1')],
        veth12ab: [info('172.19.0.1')],
        wlan0: [info('172.16.4.2')],
      }),
    ).toBe('172.16.4.2');
  });

  it('skips public, loopback and out-of-range addresses', () => {
    expect(
      lanAddress({
        lo: [info('127.0.0.1', 'IPv4', true)],
        eth0: [info('203.0.113.7'), info('172.32.0.1'), info('192.169.0.1'), info('11.0.0.1')],
      }),
    ).toBeNull();
    expect(lanAddress({})).toBeNull();
  });
});

import type { NetworkInterfaceInfo } from 'node:os';
import { describe, expect, it } from 'vitest';
import { lanAddress } from './lan.js';

function ipv4(address: string, internal = false): NetworkInterfaceInfo {
  return {
    address,
    netmask: '255.255.255.0',
    family: 'IPv4',
    mac: '00:00:00:00:00:00',
    internal,
    cidr: `${address}/24`,
  };
}

describe('lanAddress', () => {
  it('picks the first private IPv4 address on a real interface', () => {
    expect(
      lanAddress({
        lo: [ipv4('127.0.0.1', true)],
        docker0: [ipv4('172.17.0.1')],
        'br-1234': [ipv4('172.18.0.1')],
        wlan0: [ipv4('192.168.1.23')],
        eth0: [ipv4('10.0.0.5')],
      }),
    ).toBe('192.168.1.23');
  });

  it('skips public addresses', () => {
    expect(lanAddress({ eth0: [ipv4('203.0.113.7'), ipv4('172.20.4.2')] })).toBe('172.20.4.2');
  });

  it('returns null when no interface faces the LAN', () => {
    expect(lanAddress({ lo: [ipv4('127.0.0.1', true)], docker0: [ipv4('172.17.0.1')] })).toBeNull();
  });
});

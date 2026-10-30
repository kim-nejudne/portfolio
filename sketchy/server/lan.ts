// Ported from buzzer/server/env.ts (`lanAddress`).
import type { NetworkInterfaceInfo } from 'node:os';

/** Interfaces that never face the LAN: Docker's bridges and their veth pairs. */
const VIRTUAL_INTERFACE = /^(docker|br-|veth)/;

/** True for 10/8, 172.16/12 and 192.168/16. */
function isPrivateIPv4(address: string): boolean {
  const [a, b] = address.split('.').map(Number) as [number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** The first private IPv4 address on a real interface, in the order the OS lists them, or null. */
export function lanAddress(interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>): string | null {
  for (const [name, infos] of Object.entries(interfaces)) {
    if (VIRTUAL_INTERFACE.test(name)) continue;
    for (const info of infos ?? []) {
      if (info.family === 'IPv4' && !info.internal && isPrivateIPv4(info.address)) {
        return info.address;
      }
    }
  }
  return null;
}

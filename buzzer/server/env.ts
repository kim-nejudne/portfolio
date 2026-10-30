import type { NetworkInterfaceInfo } from 'node:os';
import { resolve } from 'node:path';
import { GLOBAL_IMAGES_MAX_BYTES } from '../shared/constants.js';

const MB = 1024 * 1024;

/**
 * `TRUST_PROXY`: off when unset, a hop count such as `1`, or any Express trust string (DECISIONS F06).
 * Behind a reverse proxy it must be set, or every client shares the proxy's IP in the rate limits.
 */
export function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (value === undefined || value === '') return false;
  return /^\d+$/.test(value) ? Number(value) : value;
}

/**
 * `IMAGES_MAX_MB`: lowers the server-wide image cap for a small host (DECISIONS #12).
 * Images live in memory, so the container's memory limit must leave room for this many bytes.
 */
export function parseImagesMaxBytes(value: string | undefined): number {
  if (value === undefined || value === '') return GLOBAL_IMAGES_MAX_BYTES;
  const max = GLOBAL_IMAGES_MAX_BYTES / MB;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) {
    throw new Error(`IMAGES_MAX_MB must be a whole number from 1 to ${max}, got "${value}"`);
  }
  return Number(value) * MB;
}

/**
 * `PUBLIC_URL`: the origin phones should use for the join QR and URL, such as
 * `https://buzzr.example`. Unset, the server offers its LAN address to a Screen on loopback (F42).
 */
export function parsePublicUrl(value: string | undefined): string | null {
  if (value === undefined || value === '') return null;
  const url = URL.parse(value);
  const origin =
    url !== null &&
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === '' &&
    url.username === '' &&
    url.password === '';
  if (!origin) {
    throw new Error(
      `PUBLIC_URL must be an http(s) origin such as https://buzzr.example, got "${value}"`,
    );
  }
  return url.origin;
}

/**
 * `DATA_DIR`: where the server keeps `built-in-sets.json` (F103), resolved against the working
 * directory. Defaults to `./data`; the image sets `/app/data`, a volume on the droplet.
 */
export function parseDataDir(value: string | undefined, cwd = process.cwd()): string {
  return resolve(cwd, value === undefined || value.trim() === '' ? 'data' : value);
}

/** A parsed `ADMIN_PASSWORD_HASH`: scrypt's cost parameters, the salt and the derived key. */
export interface AdminPasswordHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

/** The memory scrypt needs for these costs (OpenSSL's own count), passed to it as `maxmem`. */
export function scryptMaxmem({ N, r, p }: Pick<AdminPasswordHash, 'N' | 'r' | 'p'>): number {
  return 128 * r * (N + 2 + p);
}

/** Each sign-in holds this much for scrypt, so a typo in N cannot push the container out of memory. */
const SCRYPT_MAXMEM_CAP = 64 * MB;

/** Strict base64url bytes: no padding, and only what `Buffer` would write back the same way. */
function base64url(value: string): Buffer | null {
  if (!/^[\w-]+$/.test(value)) return null;
  const bytes = Buffer.from(value, 'base64url');
  return bytes.toString('base64url') === value ? bytes : null;
}

/**
 * `ADMIN_PASSWORD_HASH`: `scrypt$N$r$p$salt$hash` from `npm run admin:hash`, salt and hash in
 * base64url (F105). Unset or blank, there is no admin and every `/api/admin` route is 404.
 */
export function parseAdminPasswordHash(value: string | undefined): AdminPasswordHash | null {
  if (value === undefined || value.trim() === '') return null;
  const fail = (problem: string): never => {
    throw new Error(
      `ADMIN_PASSWORD_HASH must be scrypt$N$r$p$salt$hash from \`npm run admin:hash\`: ${problem}`,
    );
  };
  const parts = value.trim().split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') fail('expected 6 parts starting with "scrypt"');
  const [, n, r, p, salt, hash] = parts as [string, string, string, string, string, string];
  const int = (text: string, name: string, max: number) =>
    /^\d+$/.test(text) && Number(text) >= 1 && Number(text) <= max
      ? Number(text)
      : fail(`${name} must be a whole number from 1 to ${max}, got "${text}"`);
  const params = { N: int(n, 'N', 2 ** 20), r: int(r, 'r', 32), p: int(p, 'p', 16) };
  if (params.N < 2 || (params.N & (params.N - 1)) !== 0) fail('N must be a power of 2');
  if (scryptMaxmem(params) > SCRYPT_MAXMEM_CAP) fail('N and r need more than 64 MB per sign-in');
  const saltBytes = base64url(salt) ?? fail('the salt is not base64url');
  const hashBytes = base64url(hash) ?? fail('the hash is not base64url');
  if (saltBytes.length < 16) fail('the salt must be at least 16 bytes');
  if (hashBytes.length < 16 || hashBytes.length > 64) fail('the hash must be 16 to 64 bytes');
  return { ...params, salt: saltBytes, hash: hashBytes };
}

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

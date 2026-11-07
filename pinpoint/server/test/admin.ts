import { randomBytes, scryptSync } from 'node:crypto';
import { parseAdminPasswordHash, scryptMaxmem, type AdminPasswordHash } from '../env.js';

/** Cheap costs, so tests derive keys in a millisecond. Real hashes come from `npm run admin:hash`. */
export const TEST_COSTS = { N: 1024, r: 8, p: 1 } as const;

/** An `ADMIN_PASSWORD_HASH` for `password`, built the way `scripts/admin-hash.mjs` builds one. */
export function adminHashFor(password: string, { N, r, p } = TEST_COSTS): string {
  const salt = randomBytes(16);
  const key = scryptSync(password.normalize('NFC'), salt, 32, {
    N,
    r,
    p,
    maxmem: scryptMaxmem({ N, r, p }),
  });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

/** `adminHashFor`, parsed as the server parses `ADMIN_PASSWORD_HASH`. */
export function adminPasswordFor(password: string): AdminPasswordHash {
  return parseAdminPasswordHash(adminHashFor(password))!;
}

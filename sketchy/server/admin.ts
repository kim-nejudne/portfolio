// Admin sign-in (F80). Ported from Buzzr (buzzer/server/admin.ts: `verifyAdminPassword`,
// `AdminSessions`, `adminCookie`) with the `sketchy_admin` cookie, `endAll` for setup and reset,
// and `hashAdminPassword` from Buzzr's `scripts/admin-hash.mjs`, since Sketchy's server writes the
// hash itself (DATA_DIR/admin.env) instead of reading one from `.env`.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { ADMIN_COOKIE, ADMIN_SESSION_BYTES, ADMIN_SESSION_MS } from '../shared/constants.js';
import { scryptMaxmem, type AdminPasswordHash } from './env.js';

/** scrypt costs for a new hash: N = 2^15, r = 8 is 32 MB and about 100 ms per sign-in. */
export const SCRYPT_COSTS = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

function derive(
  password: string,
  salt: Buffer,
  keyBytes: number,
  costs: Pick<AdminPasswordHash, 'N' | 'r' | 'p'>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFC'),
      salt,
      keyBytes,
      { ...costs, maxmem: scryptMaxmem(costs) },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

/** `scrypt$N$r$p$salt$hash` for `password`, salt and key in base64url. `costs` is for tests. */
export async function hashAdminPassword(
  password: string,
  costs: Pick<AdminPasswordHash, 'N' | 'r' | 'p'> = SCRYPT_COSTS,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_BYTES, costs);
  const { N, r, p } = costs;
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

/**
 * Whether `password` derives the stored key. scrypt runs off the main thread, and the keys are the
 * same length, so `timingSafeEqual` compares them in constant time.
 */
export async function verifyAdminPassword(
  password: string,
  stored: AdminPasswordHash,
): Promise<boolean> {
  const key = await derive(password, stored.salt, stored.hash.length, stored);
  return timingSafeEqual(key, stored.hash);
}

function sha256(text: string): Buffer {
  return createHash('sha256').update(text, 'utf8').digest();
}

/**
 * Whether two secrets (the setup code) are equal, in constant time: both are hashed to 32 bytes
 * first, so neither the bytes nor the length of the real one leak through timing.
 */
export function sameSecret(given: string, expected: string): boolean {
  return timingSafeEqual(sha256(given), sha256(expected));
}

/**
 * Admin sessions in memory: the raw token goes only into the cookie, and the map keys on its
 * SHA-256, so a heap dump holds no usable session. A restart forgets them all, which signs the
 * admin out.
 */
export class AdminSessions {
  private readonly sessions = new Map<string, number>();

  constructor(private readonly ttlMs = ADMIN_SESSION_MS) {}

  /** A new session: the token for the cookie, and when it ends. */
  create(now: number): { token: string; expiresAt: number } {
    this.prune(now);
    const token = randomBytes(ADMIN_SESSION_BYTES).toString('base64url');
    const expiresAt = now + this.ttlMs;
    this.sessions.set(sha256(token).toString('hex'), expiresAt);
    return { token, expiresAt };
  }

  /** When the session ends, or null for an unknown or expired token. */
  check(token: string, now: number): number | null {
    const key = sha256(token).toString('hex');
    const expiresAt = this.sessions.get(key);
    if (expiresAt === undefined) return null;
    if (now >= expiresAt) {
      this.sessions.delete(key);
      return null;
    }
    return expiresAt;
  }

  /** Signs out. An unknown token is ignored. */
  end(token: string): void {
    this.sessions.delete(sha256(token).toString('hex'));
  }

  /** Signs every session out: a new password (setup or reset) ends them all. */
  endAll(): void {
    this.sessions.clear();
  }

  /** How many sessions are held, expired ones included until the next sign-in prunes them. */
  get size(): number {
    return this.sessions.size;
  }

  /** Drops every expired session. Sign-ins are rate-limited, so running this on each one is enough. */
  private prune(now: number): void {
    for (const [key, expiresAt] of this.sessions) {
      if (now >= expiresAt) this.sessions.delete(key);
    }
  }
}

/** The `sketchy_admin` value from a `Cookie` header, or undefined. */
export function adminCookie(header: string | undefined): string | undefined {
  for (const pair of (header ?? '').split(';')) {
    const at = pair.indexOf('=');
    if (at !== -1 && pair.slice(0, at).trim() === ADMIN_COOKIE) return pair.slice(at + 1).trim();
  }
  return undefined;
}

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { ADMIN_COOKIE, ADMIN_SESSION_BYTES, ADMIN_SESSION_MS } from '../shared/constants.js';
import { scryptMaxmem, type AdminPasswordHash } from './env.js';

/**
 * Whether `password` derives the stored key. scrypt runs off the main thread, and the keys are the
 * same length, so `timingSafeEqual` compares them in constant time.
 */
export function verifyAdminPassword(password: string, stored: AdminPasswordHash): Promise<boolean> {
  const { N, r, p, salt, hash } = stored;
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFC'),
      salt,
      hash.length,
      { N, r, p, maxmem: scryptMaxmem(stored) },
      (err, key) => (err ? reject(err) : resolve(timingSafeEqual(key, hash))),
    );
  });
}

function sha256(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Admin sessions in memory (F105): the raw token goes only into the cookie, and the map keys on its
 * SHA-256, so a heap dump holds no usable session. A restart forgets them all, which signs the admin out.
 */
export class AdminSessions {
  private readonly sessions = new Map<string, number>();

  constructor(private readonly ttlMs = ADMIN_SESSION_MS) {}

  /** A new session: the token for the cookie, and when it ends. */
  create(now: number): { token: string; expiresAt: number } {
    this.prune(now);
    const token = randomBytes(ADMIN_SESSION_BYTES).toString('base64url');
    const expiresAt = now + this.ttlMs;
    this.sessions.set(sha256(token), expiresAt);
    return { token, expiresAt };
  }

  /** When the session ends, or null for an unknown or expired token. */
  check(token: string, now: number): number | null {
    const key = sha256(token);
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
    this.sessions.delete(sha256(token));
  }

  /** Drops every expired session. Sign-ins are rate-limited, so running this on each one is enough. */
  private prune(now: number): void {
    for (const [key, expiresAt] of this.sessions) {
      if (now >= expiresAt) this.sessions.delete(key);
    }
  }
}

/** The `buzzr_admin` value from a `Cookie` header, or undefined. */
export function adminCookie(header: string | undefined): string | undefined {
  for (const pair of (header ?? '').split(';')) {
    const at = pair.indexOf('=');
    if (at !== -1 && pair.slice(0, at).trim() === ADMIN_COOKIE) return pair.slice(at + 1).trim();
  }
  return undefined;
}

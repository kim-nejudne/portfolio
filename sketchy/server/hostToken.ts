// Ported from Buzzr (buzzer/server/hostToken.ts), as is.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { HOST_TOKEN_BYTES } from '../shared/constants.js';

/** A fresh hostToken: `HOST_TOKEN_BYTES` random bytes from the CSPRNG, as base64url (43 characters). */
export function generateHostToken(): string {
  return randomBytes(HOST_TOKEN_BYTES).toString('base64url');
}

/** SHA-256 of the token, as hex. The room stores only this; the raw token goes to the creator once. */
export function hashHostToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Whether `token` hashes to `storedHash`. Both sides are 32-byte digests, so `timingSafeEqual`
 * compares them in constant time whatever the candidate's length.
 */
export function verifyHostToken(token: string, storedHash: string): boolean {
  const candidate = createHash('sha256').update(token, 'utf8').digest();
  const stored = Buffer.from(storedHash, 'hex');
  return stored.length === candidate.length && timingSafeEqual(candidate, stored);
}

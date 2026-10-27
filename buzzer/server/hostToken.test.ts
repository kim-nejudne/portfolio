import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HOST_TOKEN_LENGTH } from '../shared/constants.js';
import { hostTokenSchema } from '../shared/schemas.js';
import { generateHostToken, hashHostToken, verifyHostToken } from './hostToken.js';

describe('hostToken', () => {
  it('generates 43-character base64url tokens that pass the schema and differ each time', () => {
    const a = generateHostToken();
    const b = generateHostToken();
    expect(a).toHaveLength(HOST_TOKEN_LENGTH);
    expect(hostTokenSchema.safeParse(a).success).toBe(true);
    expect(a).not.toBe(b);
  });

  it('hashes with SHA-256 as hex', () => {
    const token = generateHostToken();
    expect(hashHostToken(token)).toBe(createHash('sha256').update(token).digest('hex'));
    expect(hashHostToken(token)).not.toContain(token);
  });

  it('verifies the matching token', () => {
    const token = generateHostToken();
    expect(verifyHostToken(token, hashHostToken(token))).toBe(true);
  });

  it('rejects a different token, an empty token and a one-character change', () => {
    const token = generateHostToken();
    const hash = hashHostToken(token);
    const flipped = (token[0] === 'A' ? 'B' : 'A') + token.slice(1);
    expect(verifyHostToken(generateHostToken(), hash)).toBe(false);
    expect(verifyHostToken('', hash)).toBe(false);
    expect(verifyHostToken(flipped, hash)).toBe(false);
  });

  it('rejects the stored hash itself when offered as a token', () => {
    const hash = hashHostToken(generateHostToken());
    expect(verifyHostToken(hash, hash)).toBe(false);
  });

  it('returns false instead of throwing on a malformed stored hash', () => {
    expect(verifyHostToken(generateHostToken(), 'not-hex')).toBe(false);
    expect(verifyHostToken(generateHostToken(), '')).toBe(false);
  });
});

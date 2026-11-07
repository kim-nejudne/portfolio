import { z } from 'zod';
import { DEFAULT_PORT } from '#shared/constants.js';

/**
 * The server's environment (spec: Milestones and acceptance criteria, Environment). Parsed once at
 * start; a bad value stops the server naming the variable. Keys are kept as given and never logged.
 */
export interface Env {
  production: boolean;
  port: number;
  dataDir: string;
  /** Express's `trust proxy` value: false (off), a hop count, or any Express trust string. */
  trustProxy: boolean | number | string;
  publicUrl: string;
  /** `ADMIN_PASSWORD_HASH`, parsed; null when unset or blank (every `/api/admin` route is 404). */
  adminPasswordHash: AdminPasswordHash | null;
  anthropicApiKey: string | null;
  cartoKey: string | null;
  wikimediaContact: string | null;
  generateDailyLimit: number;
  generateReplaceDailyLimit: number;
  generateFake: boolean;
  photosMaxMb: number;
}

/** Unset and blank mean the same: absent. */
const optional = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? null : v.trim()));

const positiveInt = (fallback: number) =>
  optional
    .pipe(
      z
        .string()
        .regex(/^\d+$/, 'must be a whole number')
        .transform(Number)
        .refine((n) => n > 0, 'must be above 0')
        .nullable(),
    )
    .transform((n) => n ?? fallback);

const schema = z.object({
  NODE_ENV: optional,
  PORT: optional.pipe(
    z
      .string()
      .regex(/^\d+$/, 'must be a port number')
      .transform(Number)
      .refine((n) => n > 0 && n < 65536, 'must be 1–65535')
      .nullable(),
  ),
  DATA_DIR: optional,
  TRUST_PROXY: optional,
  PUBLIC_URL: optional.pipe(z.url().nullable()),
  ADMIN_PASSWORD_HASH: optional,
  PINPOINT_ANTHROPIC_API_KEY: optional,
  PINPOINT_CARTO_KEY: optional,
  WIKIMEDIA_CONTACT: optional,
  GENERATE_DAILY_LIMIT: positiveInt(20),
  GENERATE_REPLACE_DAILY_LIMIT: positiveInt(100),
  GENERATE_FAKE: optional,
  PHOTOS_MAX_MB: positiveInt(1024),
});

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
const SCRYPT_MAXMEM_CAP = 64 * 1024 * 1024;

/** Strict base64url bytes: no padding, and only what `Buffer` would write back the same way. */
function base64url(value: string): Buffer | null {
  if (!/^[\w-]+$/.test(value)) return null;
  const bytes = Buffer.from(value, 'base64url');
  return bytes.toString('base64url') === value ? bytes : null;
}

/**
 * `ADMIN_PASSWORD_HASH`: `scrypt$N$r$p$salt$hash` from `npm run admin:hash`, salt and hash in
 * base64url (as Buzzr). Null (unset or blank) means no admin.
 */
export function parseAdminPasswordHash(value: string | null): AdminPasswordHash | null {
  if (value === null) return null;
  const fail = (problem: string): never => {
    throw new Error(
      `Invalid environment: ADMIN_PASSWORD_HASH must be scrypt$N$r$p$salt$hash from \`npm run admin:hash\`: ${problem}`,
    );
  };
  const parts = value.split('$');
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

function parseTrustProxy(value: string | null): boolean | number | string {
  if (value === null || value === 'false') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment: ${problems.join('; ')}`);
  }
  const e = result.data;
  const production = e.NODE_ENV === 'production';
  return {
    production,
    port: e.PORT ?? DEFAULT_PORT,
    dataDir: e.DATA_DIR ?? (production ? '/app/data' : './.data'),
    trustProxy: parseTrustProxy(e.TRUST_PROXY),
    publicUrl: (e.PUBLIC_URL ?? 'https://pinpoint.kimnejudne.dev').replace(/\/+$/, ''),
    adminPasswordHash: parseAdminPasswordHash(e.ADMIN_PASSWORD_HASH),
    anthropicApiKey: e.PINPOINT_ANTHROPIC_API_KEY,
    cartoKey: e.PINPOINT_CARTO_KEY,
    wikimediaContact: e.WIKIMEDIA_CONTACT,
    generateDailyLimit: e.GENERATE_DAILY_LIMIT,
    generateReplaceDailyLimit: e.GENERATE_REPLACE_DAILY_LIMIT,
    generateFake: e.GENERATE_FAKE === '1',
    photosMaxMb: e.PHOTOS_MAX_MB,
  };
}

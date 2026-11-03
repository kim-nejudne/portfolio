// Environment parsing. `parseTrustProxy`, `parseDataDir` and `parseAdminPasswordHash` are ported
// from Buzzr (buzzer/server/env.ts), `parseTrustProxy` plus `true`/`false`; the hash comes from
// `DATA_DIR/admin.env` rather than the environment (F80).
import { resolve } from 'node:path';
import { GENERATION_CAP_DEFAULT_USD, GENERATION_CAP_VAR } from '../shared/constants.js';

/**
 * `TRUST_PROXY`: Express's `trust proxy` setting, so `req.ip` (the rate-limit key) is the client's
 * address behind nginx. Unset, empty or `false`, it is off; `true` trusts every hop; a whole number is a hop count; anything else
 * passes through as an Express trust string (`loopback`, a CIDR list).
 */
export function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (value === undefined || value === '' || value === 'false') return false;
  // Express would read the string "true" as an address list, so it must be the boolean.
  if (value === 'true') return true;
  return /^\d+$/.test(value) ? Number(value) : value;
}

/**
 * Dev tools (the `/api/dev` routes for `/dev/bots`) are opt-in: only `NODE_ENV=development`, which
 * `npm run dev` sets. Unset or anything else is off, so a deploy that forgets `NODE_ENV` stays
 * closed rather than serving the word.
 */
export function devToolsEnabled(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'development';
}

/**
 * `DATA_DIR`: the folder for `categories.json` (the CategoryStore), resolved against the working
 * directory. Unset or blank, `./.data` (gitignored); the image sets `/data`, a volume on the
 * droplet that sits outside `/app`, so it never hides the seed packs at `/app/data/packs`
 * (DECISIONS 101).
 */
export function parseDataDir(value: string | undefined, cwd = process.cwd()): string {
  return resolve(cwd, value === undefined || value.trim() === '' ? '.data' : value);
}

/** A setup code shorter than this gets a start-up warning: it is guessed online at 5 a minute per IP. */
export const ADMIN_SETUP_CODE_ADVISED = 16;

/**
 * `SKETCHY_ADMIN_SETUP_CODE`: the key that sets the first admin password and resets a forgotten
 * one (Admin access), trimmed; null when unset or blank. Never logged.
 */
export function parseAdminSetupCode(value: string | undefined): string | null {
  const code = value?.trim();
  return code ? code : null;
}

/** A parsed `ADMIN_PASSWORD_HASH`: scrypt's cost parameters, the salt and the derived key. */
export interface AdminPasswordHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

const MB = 1024 * 1024;

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
 * `ADMIN_PASSWORD_HASH`: `scrypt$N$r$p$salt$hash`, salt and hash in base64url, as the server
 * writes it to `DATA_DIR/admin.env`. Unset or blank is null (no password: setup mode). Throws
 * when malformed; the message names the problem, never the value.
 */
export function parseAdminPasswordHash(value: string | undefined): AdminPasswordHash | null {
  if (value === undefined || value.trim() === '') return null;
  const fail = (problem: string): never => {
    throw new Error(`ADMIN_PASSWORD_HASH must be scrypt$N$r$p$salt$hash: ${problem}`);
  };
  const parts = value.trim().split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') fail('expected 6 parts starting with "scrypt"');
  const [, n, r, p, salt, hash] = parts as [string, string, string, string, string, string];
  const int = (text: string, name: string, max: number) =>
    /^\d+$/.test(text) && Number(text) >= 1 && Number(text) <= max
      ? Number(text)
      : fail(`${name} must be a whole number from 1 to ${max}`);
  const params = { N: int(n, 'N', 2 ** 20), r: int(r, 'r', 32), p: int(p, 'p', 16) };
  if (params.N < 2 || (params.N & (params.N - 1)) !== 0) fail('N must be a power of 2');
  if (scryptMaxmem(params) > SCRYPT_MAXMEM_CAP) fail('N and r need more than 64 MB per sign-in');
  const saltBytes = base64url(salt) ?? fail('the salt is not base64url');
  const hashBytes = base64url(hash) ?? fail('the hash is not base64url');
  if (saltBytes.length < 16) fail('the salt must be at least 16 bytes');
  if (hashBytes.length < 16 || hashBytes.length > 64) fail('the hash must be 16 to 64 bytes');
  return { ...params, salt: saltBytes, hash: hashBytes };
}

/**
 * `SKETCHY_ANTHROPIC_API_KEY` (F83): the Claude API key for word generation, or null when unset or
 * blank (generation off in production). Ported from Buzzr's `parseAnthropicApiKey`.
 */
export function parseAnthropicApiKey(value: string | undefined): string | null {
  const key = value?.trim();
  return key ? key : null;
}

/**
 * `SKETCHY_GENERATION_CAP_USD` (F84): the most word generation may spend per UTC calendar month,
 * in US dollars. Unset or blank is the default, $5. A value that isn't a plain number of 0 or more
 * (`5x`, `-1`, `Infinity`) is the default too, with a warning that never quotes the value: a typo
 * must not lift the cap, and the game must not stop over the admin. 0 turns generation off.
 */
// SPEC-QUESTION: the spec gives the default only; an invalid value falls back to it (DECISIONS 110).
export function parseGenerationCap(value: string | undefined): {
  capUsd: number;
  warning: string | null;
} {
  const text = value?.trim() ?? '';
  if (text === '') return { capUsd: GENERATION_CAP_DEFAULT_USD, warning: null };
  if (/^\d+(\.\d+)?$/.test(text)) return { capUsd: Number(text), warning: null };
  return {
    capUsd: GENERATION_CAP_DEFAULT_USD,
    warning: `${GENERATION_CAP_VAR} is not a number of dollars (such as 5 or 2.50); using the default, $${GENERATION_CAP_DEFAULT_USD}.`,
  };
}

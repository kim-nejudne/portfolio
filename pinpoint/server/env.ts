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
  adminPasswordHash: string | null;
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
    adminPasswordHash: e.ADMIN_PASSWORD_HASH,
    anthropicApiKey: e.PINPOINT_ANTHROPIC_API_KEY,
    cartoKey: e.PINPOINT_CARTO_KEY,
    wikimediaContact: e.WIKIMEDIA_CONTACT,
    generateDailyLimit: e.GENERATE_DAILY_LIMIT,
    generateReplaceDailyLimit: e.GENERATE_REPLACE_DAILY_LIMIT,
    generateFake: e.GENERATE_FAKE === '1',
    photosMaxMb: e.PHOTOS_MAX_MB,
  };
}

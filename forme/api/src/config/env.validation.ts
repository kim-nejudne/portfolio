import { plainToInstance } from 'class-transformer';
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Environment contract, validated once at boot.
 *
 * The app refuses to start rather than booting half-configured — a missing
 * JWT_SECRET should be a failed deploy, not an auth system that silently signs
 * every token with `undefined`. TALLOW does the same with SESSION_SECRET, and
 * for the same reason.
 */
export class EnvironmentVariables {
  @IsOptional()
  @IsString()
  NODE_ENV: string = 'development';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  @IsString()
  @MinLength(1, { message: 'DATABASE_URL is required. The API has no fallback datastore.' })
  DATABASE_URL!: string;

  /**
   * 32 bytes minimum. Short secrets are the difference between signed tokens
   * and decorative ones, and nothing downstream can compensate for a weak key.
   */
  @IsString()
  @MinLength(32, {
    message:
      'JWT_SECRET must be at least 32 characters. Generate one with `openssl rand -base64 48`.',
  })
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL: string = '15m';

  @IsOptional()
  @IsString()
  JWT_REFRESH_TTL: string = '7d';

  /** Comma-separated. The browser origin(s) allowed to send credentialed requests. */
  @IsOptional()
  @IsString()
  WEB_ORIGIN: string = 'http://localhost:3000';

  /** Where artwork lands. A real directory on a real disk — there is no blob store here. */
  @IsOptional()
  @IsString()
  ARTWORK_DIR: string = './.artwork';

  @IsOptional()
  @IsInt()
  @Min(1)
  ARTWORK_MAX_BYTES: number = 200 * 1024 * 1024;

  /** Days to keep artwork after a job is despatched, before the retention cron purges it. */
  @IsOptional()
  @IsInt()
  @Min(1)
  ARTWORK_RETENTION_DAYS: number = 90;

  /**
   * Preflight shells out to ghostscript, which is CPU-bound. The droplet has two
   * shared vCPUs, so more than one concurrent job makes every job slower and
   * starves the request handler.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  PREFLIGHT_CONCURRENCY: number = 1;

  @IsOptional()
  @IsInt()
  @Min(5_000)
  PREFLIGHT_TIMEOUT_MS: number = 120_000;

  @IsOptional()
  @IsBooleanString()
  SWAGGER_ENABLED?: string;

  /** Seeded demo accounts share this password so the portfolio is walkable. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  DEMO_PASSWORD: string = 'forme-demo-2026';
}

const NUMERIC_KEYS = [
  'PORT',
  'ARTWORK_MAX_BYTES',
  'ARTWORK_RETENTION_DAYS',
  'PREFLIGHT_CONCURRENCY',
  'PREFLIGHT_TIMEOUT_MS',
] as const;

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  // Everything arrives from the environment as a string; coerce the numerics
  // before validation so `PORT=4000` is an integer rather than a failed @IsInt.
  const coerced: Record<string, unknown> = { ...raw };
  for (const key of NUMERIC_KEYS) {
    const value = coerced[key];
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) coerced[key] = parsed;
    }
  }

  const config = plainToInstance(EnvironmentVariables, coerced, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });

  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length > 0) {
    const detail = errors
      .map((error) => `  ${error.property}: ${Object.values(error.constraints ?? {}).join('; ')}`)
      .join('\n');
    throw new Error(`Invalid environment. The API will not start.\n${detail}`);
  }
  return config;
}

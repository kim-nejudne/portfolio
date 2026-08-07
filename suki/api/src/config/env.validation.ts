import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

/**
 * Environment contract, validated once at boot. The API refuses to start rather
 * than running half-configured — the same posture as TALLOW, FORME and
 * PokéTrack, the last of which shipped a hardcoded fallback secret precisely
 * because nothing forced the question.
 */
export class EnvironmentVariables {
  @IsOptional() @IsString() NODE_ENV: string = 'development';

  @IsOptional() @IsInt() @Min(1) @Max(65535) PORT: number = 4100;

  @IsString()
  @MinLength(1, { message: 'DATABASE_URL is required. The API has no fallback datastore.' })
  DATABASE_URL!: string;

  /**
   * The shared device key every sync request must present. No default: a sync
   * endpoint that accepts anonymous writes is one anyone can append to, and a
   * committed fallback is not a secret.
   */
  @IsString()
  @MinLength(32, {
    message:
      'DEVICE_KEY must be at least 32 characters. Generate one with `openssl rand -base64 48`.',
  })
  DEVICE_KEY!: string;

  /** Comma-separated browser origins allowed to sync. */
  @IsOptional() @IsString() WEB_ORIGIN: string = 'http://localhost:3000';
}

const NUMERIC = ['PORT'] as const;

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const coerced: Record<string, unknown> = { ...raw };
  for (const key of NUMERIC) {
    const v = coerced[key];
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (Number.isFinite(n)) coerced[key] = n;
    }
  }
  const config = plainToInstance(EnvironmentVariables, coerced, { exposeDefaultValues: true });
  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length > 0) {
    const detail = errors
      .map((e) => `  ${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`)
      .join('\n');
    throw new Error(`Invalid environment. The API will not start.\n${detail}`);
  }
  return config;
}

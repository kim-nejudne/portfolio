import { z } from 'zod';

/** An environment: every variable is a string, or missing. */
export type Env = Record<string, string | undefined>;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Config = {
  apiUrl: string;
  port: number;
  logLevel: LogLevel;
  debug: boolean;
};

export type ConfigResult =
  { ok: true; config: Config } | { ok: false; errors: string[] };

const Settings = z.object({
  API_URL: z.string().startsWith('https://'),
  PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DEBUG: z
    .enum(['true', 'false'])
    .transform((text) => text === 'true')
    .default(false),
});

/** Reads API_URL, PORT, LOG_LEVEL and DEBUG from `env`. */
export function loadConfig(env: Env): ConfigResult {
  const set = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== ''),
  );
  const result = Settings.safeParse(set);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(
        (issue) => `${String(issue.path[0])}: ${issue.message}`,
      ),
    };
  }
  const { API_URL, PORT, LOG_LEVEL, DEBUG } = result.data;
  return {
    ok: true,
    config: { apiUrl: API_URL, port: PORT, logLevel: LOG_LEVEL, debug: DEBUG },
  };
}

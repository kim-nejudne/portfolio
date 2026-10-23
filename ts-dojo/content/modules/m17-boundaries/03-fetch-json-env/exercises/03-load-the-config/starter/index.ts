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

/** Reads API_URL, PORT, LOG_LEVEL and DEBUG from `env`. */
export function loadConfig(env: Env): ConfigResult {
  throw new Error(`not implemented for ${Object.keys(env).length} variables`);
}

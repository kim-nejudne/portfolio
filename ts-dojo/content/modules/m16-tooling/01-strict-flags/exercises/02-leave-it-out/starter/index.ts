export type RequestOptions = { timeoutMs?: number; retries?: number };

/**
 * A copy of `options` with the timeout set to `timeoutMs`. `undefined` means no timeout: the
 * copy then has no `timeoutMs` property at all, even when `options` had one.
 */
export function withTimeout(
  options: RequestOptions,
  timeoutMs: number | undefined,
): RequestOptions {
  return { ...options, timeoutMs };
}

/** A copy of `options` that tries one more time than before; no `retries` counts as 0. */
export function oneMoreRetry(options: RequestOptions): RequestOptions {
  return { ...options, retries: (options.retries ?? 0) + 1 };
}

/**
 * Calls `attempt` with the attempt number, 1, 2, 3 and so on, until it returns true, at most
 * `times` times (3 unless given). After each attempt that fails, calls `onFailure` with that
 * attempt's number. Returns whether an attempt worked.
 */
export function retry(
  attempt: unknown,
  onFailure: unknown,
  times?: unknown,
): boolean {
  throw new Error('not implemented: retry');
}

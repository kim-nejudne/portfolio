/**
 * Calls `attempt` with the attempt number, 1, 2, 3 and so on, until it returns true, at most
 * `times` times (3 unless given). After each attempt that fails, calls `onFailure` with that
 * attempt's number. Returns whether an attempt worked.
 */
export function retry(
  attempt: (n: number) => boolean,
  onFailure: (n: number) => void,
  times = 3,
): boolean {
  for (let n = 1; n <= times; n++) {
    if (attempt(n)) return true;
    onFailure(n);
  }
  return false;
}

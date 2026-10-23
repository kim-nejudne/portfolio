export type Result<T, E = string> =
  { ok: true; value: T } | { ok: false; error: E };

/** `thrown` itself if it is an Error, else a new Error with String(thrown) as its message and thrown as its cause. */
export function toError(thrown: unknown): Error {
  throw new Error(`not implemented: ${String(thrown)}`);
}

/** Calls `fn` once: ok with what it returned, or not ok with what it threw, as an Error. */
export function attempt<T>(fn: () => T): Result<T, Error> {
  throw new Error(`not implemented: ${fn.name}`);
}

/** Waits for `promise`: ok with its value, or not ok with its rejection reason, as an Error. Never rejects. */
export async function settle<T>(
  promise: Promise<T>,
): Promise<Result<T, Error>> {
  throw new Error(`not implemented: ${String(promise)}`);
}

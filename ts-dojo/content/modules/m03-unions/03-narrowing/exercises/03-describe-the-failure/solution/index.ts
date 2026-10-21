/** Thrown when a request takes longer than `ms` milliseconds. */
export class TimeoutError extends Error {
  ms: number;

  constructor(ms: number) {
    super(`request took longer than ${ms} ms`);
    this.ms = ms;
  }
}

/** A response that came back with an error status, such as 404 Not Found. */
export type HttpFailure = { status: number; statusText: string };

/** What a failed request produces. */
export type Failure = string | Error | HttpFailure;

/**
 * - a TimeoutError: 'timeout (5000 ms)'
 * - any other Error: 'error: disk full'
 * - an HttpFailure: 'HTTP 404 Not Found'
 * - a string: the string as it is
 */
export function describeFailure(failure: Failure): string {
  if (typeof failure === 'string') {
    return failure;
  } else if (failure instanceof TimeoutError) {
    return `timeout (${failure.ms} ms)`;
  } else if (failure instanceof Error) {
    return `error: ${failure.message}`;
  } else {
    // only HttpFailure is left
    return `HTTP ${failure.status} ${failure.statusText}`;
  }
}

export class HttpError extends Error {
  override name = 'HttpError';
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Runs `request` and describes how it went. */
export function report(request: () => string): string {
  try {
    return `ok: ${request()}`;
  } catch (error: Error) {
    if (error.status !== undefined) {
      return `HTTP ${error.status}: ${error.message}`;
    }
    return `failed: ${error.message}`;
  }
}

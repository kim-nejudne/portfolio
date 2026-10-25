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
  } catch (error) {
    if (error instanceof HttpError) {
      return `HTTP ${error.status}: ${error.message}`;
    }
    if (error instanceof Error) {
      return `failed: ${error.message}`;
    }
    return `failed: ${String(error)}`;
  }
}

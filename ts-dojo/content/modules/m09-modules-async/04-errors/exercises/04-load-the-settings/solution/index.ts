export type Result<T, E = string> =
  { ok: true; value: T } | { ok: false; error: E };

export interface Settings {
  theme: 'light' | 'dark';
  fontSize: number;
}

export type SettingsError =
  | { kind: 'missing'; path: string }
  | { kind: 'syntax'; message: string }
  | { kind: 'invalid'; field: 'theme' | 'fontSize' };

export class NotFoundError extends Error {
  override name = 'NotFoundError';
  readonly path: string;

  constructor(path: string) {
    super(`no file at ${path}`);
    this.path = path;
  }
}

/** Resolves to the text of the file at `path`; rejects with a NotFoundError when there is none. */
export type ReadFile = (path: string) => Promise<string>;

/** Reads, parses and checks the settings at `path`. Rejects only when `read` fails unexpectedly. */
export async function loadSettings(
  read: ReadFile,
  path: string,
): Promise<Result<Settings, SettingsError>> {
  let text: string;
  try {
    text = await read(path);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { ok: false, error: { kind: 'missing', path } };
    }
    throw error;
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: { kind: 'syntax', message } };
  }

  if (
    typeof data !== 'object' ||
    data === null ||
    !('theme' in data) ||
    (data.theme !== 'light' && data.theme !== 'dark')
  ) {
    return { ok: false, error: { kind: 'invalid', field: 'theme' } };
  }
  if (!('fontSize' in data) || typeof data.fontSize !== 'number') {
    return { ok: false, error: { kind: 'invalid', field: 'fontSize' } };
  }
  return { ok: true, value: { theme: data.theme, fontSize: data.fontSize } };
}

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
  throw new Error(`not implemented: ${path} with ${read.name}`);
}

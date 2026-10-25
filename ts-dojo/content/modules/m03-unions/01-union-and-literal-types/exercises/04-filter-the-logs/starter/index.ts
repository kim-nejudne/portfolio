/** The four log levels, least severe first: 'debug', 'info', 'warn', 'error'. */
export type Level = string;

/** One log line: a `level` and a `message`. */
export type LogEntry = unknown;

/** Every level, least severe first. */
export const LEVELS: readonly Level[] = ['debug', 'info', 'warn', 'error'];

/** The entries at `min` or more severe, in their original order. `min` defaults to 'info'. */
export function atLeast(
  entries: readonly LogEntry[],
  min: Level = 'info',
): LogEntry[] {
  throw new Error(`not implemented for ${entries.length} entries at ${min}`);
}

/** One line of output, such as '[WARN] disk almost full'. */
export function formatEntry(entry: LogEntry): string {
  throw new Error(`not implemented for ${JSON.stringify(entry)}`);
}

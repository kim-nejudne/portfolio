/** The four log levels, least severe first: 'debug', 'info', 'warn', 'error'. */
export type Level = 'debug' | 'info' | 'warn' | 'error';

/** One log line: a `level` and a `message`. */
export type LogEntry = { level: Level; message: string };

/** Every level, least severe first. */
export const LEVELS: readonly Level[] = ['debug', 'info', 'warn', 'error'];

/** The entries at `min` or more severe, in their original order. `min` defaults to 'info'. */
export function atLeast(
  entries: readonly LogEntry[],
  min: Level = 'info',
): LogEntry[] {
  return entries.filter(
    (entry) => LEVELS.indexOf(entry.level) >= LEVELS.indexOf(min),
  );
}

/** One line of output, such as '[WARN] disk almost full'. */
export function formatEntry(entry: LogEntry): string {
  return `[${entry.level.toUpperCase()}] ${entry.message}`;
}

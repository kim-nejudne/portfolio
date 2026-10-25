import type { Equal, Expect } from '@dojo/type-utils';
import { atLeast, formatEntry, type Level, type LogEntry } from './index';

type cases = [
  Expect<Equal<Level, 'debug' | 'info' | 'warn' | 'error'>>, // Level is exactly the four levels
  Expect<Equal<LogEntry, { level: Level; message: string }>>, // a LogEntry is a level and a message
];

// @ts-expect-error
const fatal: LogEntry = { level: 'fatal', message: 'boom' }; // 'fatal' is not a level

// @ts-expect-error
const verbose = () => atLeast([], 'verbose'); // 'verbose' is not a level

const levels: readonly Level[] = ['debug', 'info', 'warn', 'error'];

const entries: readonly LogEntry[] = [
  { level: 'debug', message: 'cache warmed' },
  { level: 'warn', message: 'disk almost full' },
  { level: 'info', message: 'server started' },
  { level: 'error', message: 'request failed' },
];

test('min defaults to info', () => {
  expect(atLeast(entries)).toEqual([entries[1], entries[2], entries[3]]);
});

test('warn keeps warn and error, in order', () => {
  expect(atLeast(entries, 'warn')).toEqual([entries[1], entries[3]]);
});

test('debug keeps every entry', () => {
  expect(atLeast(entries, 'debug')).toEqual(entries);
});

test('error keeps only the errors', () => {
  expect(atLeast(entries, 'error')).toEqual([entries[3]]);
});

test('no entries gives no entries', () => {
  expect(atLeast([], 'debug')).toEqual([]);
});

test('generated entries: each min keeps exactly its level and the ones above', () => {
  const generated: LogEntry[] = [];
  const kept: LogEntry[][] = [[], [], [], []];
  for (let i = 0; i < 40; i++) {
    const severity = (i * 7) % 4;
    const entry: LogEntry = { level: levels[severity], message: `entry ${i}` };
    generated.push(entry);
    for (let min = 0; min <= severity; min++) kept[min].push(entry);
  }
  levels.forEach((min, index) => {
    expect(atLeast(generated, min)).toEqual(kept[index]);
  });
});

test('the input is not changed', () => {
  const before = [...entries];
  atLeast(entries, 'error');
  expect(entries).toEqual(before);
});

test('formatEntry puts the level in upper case', () => {
  expect(formatEntry({ level: 'warn', message: 'disk almost full' })).toBe(
    '[WARN] disk almost full',
  );
  expect(formatEntry({ level: 'debug', message: 'cache warmed' })).toBe(
    '[DEBUG] cache warmed',
  );
});

test('formatEntry for every level and generated messages', () => {
  for (let i = 0; i < 20; i++) {
    const level = levels[i % 4];
    const message = `message number ${i * 13}`;
    expect(formatEntry({ level, message })).toBe(
      `[${level.toUpperCase()}] ${message}`,
    );
  }
});

export { fatal, verbose };

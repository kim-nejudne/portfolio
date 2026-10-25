import type { Equal, Expect } from '@dojo/type-utils';
import { LEVELS, atLeast, severity, type Level, type Severity } from './index';

type cases = [
  Expect<Equal<Level, 'debug' | 'info' | 'warn' | 'error'>>, // Level is every key of LEVELS
  Expect<Equal<Severity, 10 | 20 | 30 | 40>>, // Severity is every value of LEVELS
];

// @ts-expect-error
const trace = severity('trace'); // trace is not a level

// @ts-expect-error
const loud: Severity = 50; // 50 is not one of the severities

const levels: Level[] = ['debug', 'info', 'warn', 'error'];

test('severity of every level', () => {
  expect(severity('debug')).toBe(10);
  expect(severity('info')).toBe(20);
  expect(severity('warn')).toBe(30);
  expect(severity('error')).toBe(40);
});

test('severity reads LEVELS', () => {
  for (const level of levels) {
    expect(severity(level)).toBe(LEVELS[level]);
  }
});

test('atLeast compares the severities of every pair of levels', () => {
  for (const level of levels) {
    for (const threshold of levels) {
      expect(atLeast(level, threshold)).toBe(
        LEVELS[level] >= LEVELS[threshold],
      );
    }
  }
});

export { trace, loud };

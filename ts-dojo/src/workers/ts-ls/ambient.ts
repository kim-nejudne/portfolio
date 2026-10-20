// The ambient declarations ts-dojo adds to a project (not lesson files; the "Spec questions"
// entries in docs/progress.md). The §2 defaults use `lib: ["es2025"]` with no DOM, so `console`
// and the timers are undeclared; /dojo/runtime.d.ts declares what the sandbox provides at run
// time: exactly the prelude's console shim (src/workers/sandbox/prelude.ts) and the timers it
// wraps, plus the worker's own `queueMicrotask`. It is left out when the project's lib set
// already declares them (dom, webworker), where it would clash. A project with a tests.ts also
// gets /dojo/test-harness.d.ts (the §5 `test`, `test.skip` and `expect` the sandbox harness
// defines as globals, src/workers/sandbox/harness.ts) and /dojo/type-utils.d.ts (the
// `@dojo/type-utils` module, src/verify/type-utils.ts). Paths under /dojo/ are reserved: never
// editable, never a tab.
import { isTestFile } from '@/verify/rules';
import { TYPE_UTILS_DTS } from '@/verify/type-utils';

export const AMBIENT_RUNTIME_PATH = '/dojo/runtime.d.ts';

export const AMBIENT_RUNTIME_DTS = `// Added by ts-dojo to every project: what the sandbox provides at run time.
interface DojoConsole {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}
declare const console: DojoConsole;
declare function setTimeout(callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]): number;
declare function clearTimeout(id: number | undefined): void;
declare function setInterval(callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]): number;
declare function clearInterval(id: number | undefined): void;
declare function queueMicrotask(callback: () => void): void;
`;

export const AMBIENT_TEST_HARNESS_PATH = '/dojo/test-harness.d.ts';

/** §5 Runtime tests: the globals tests.ts uses with no import. Mirrors src/workers/sandbox/harness.ts. */
export const AMBIENT_TEST_HARNESS_DTS = `// Added by ts-dojo to a project with a tests.ts: the sandbox test harness (§5).
type DojoTestFn = () => void | Promise<void>;
declare function test(name: string, fn: DojoTestFn): void;
declare namespace test {
  function skip(name: string, fn: DojoTestFn): void;
}
interface DojoMatchers<R> {
  /** Object.is */
  toBe(expected: unknown): R;
  /** Structural: arrays, plain objects, Map, Set, Date. */
  toEqual(expected: unknown): R;
  toBeCloseTo(expected: number, digits?: number): R;
  /** The received function throws; with a message, the error message contains or matches it. */
  toThrow(message?: string | RegExp): R;
  toBeInstanceOf(constructor: abstract new (...args: never[]) => unknown): R;
  /** An array element (Object.is) or a substring. */
  toContain(item: unknown): R;
  toHaveLength(length: number): R;
  toBeUndefined(): R;
  toBeNull(): R;
}
interface DojoAsyncMatchers extends DojoMatchers<Promise<void>> {
  readonly not: DojoMatchers<Promise<void>>;
}
interface DojoExpectation extends DojoMatchers<void> {
  readonly not: DojoMatchers<void>;
  /** The received promise resolves, then the matcher runs on its value. */
  readonly resolves: DojoAsyncMatchers;
  /** The received promise rejects, then the matcher runs on the reason. */
  readonly rejects: DojoAsyncMatchers;
}
declare function expect(value: unknown): DojoExpectation;
`;

export const AMBIENT_TYPE_UTILS_PATH = '/dojo/type-utils.d.ts';
export const AMBIENT_TYPE_UTILS_DTS = TYPE_UTILS_DTS;

/** Libs that declare console and the timers themselves. */
const DECLARING_LIBS = new Set(['lib.dom.d.ts', 'lib.webworker.d.ts']);

export function needsAmbientRuntime(libFileNames: readonly string[]): boolean {
  return !libFileNames.some((name) => DECLARING_LIBS.has(name));
}

/** The harness and type-utils declarations join a project that has a tests.ts (§5). */
export function needsAmbientTests(paths: readonly string[]): boolean {
  return paths.some((path) => isTestFile(path));
}

/** Paths under this prefix belong to the app, never to the lesson or the user. */
export const AMBIENT_PREFIX = '/dojo/';

export function isAmbientPath(path: string): boolean {
  return path.startsWith(AMBIENT_PREFIX);
}

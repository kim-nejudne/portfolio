// The ambient declarations ts-dojo adds to every project (not a lesson file; the "Spec
// questions" entry in docs/progress.md). The §2 defaults use `lib: ["es2025"]` with no DOM, so
// `console` and the timers are undeclared; this file declares what the sandbox provides at run
// time (F4 widens it to exactly the shim's surface; F7 adds the test harness types). It is left
// out when the project's lib set already declares them (dom, webworker), where it would clash.

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

/** Libs that declare console and the timers themselves. */
const DECLARING_LIBS = new Set(['lib.dom.d.ts', 'lib.webworker.d.ts']);

export function needsAmbientRuntime(libFileNames: readonly string[]): boolean {
  return !libFileNames.some((name) => DECLARING_LIBS.has(name));
}

/** Paths under this prefix belong to the app, never to the lesson or the user. */
export const AMBIENT_PREFIX = '/dojo/';

export function isAmbientPath(path: string): boolean {
  return path.startsWith(AMBIENT_PREFIX);
}

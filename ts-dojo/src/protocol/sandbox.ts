// The §2 message protocol between the UI and the sandbox worker, plus the §4 caps and the
// default deadline. Both sides import this file; no literal is duplicated elsewhere. A fresh
// worker runs one `run` request and is terminated by the UI (there is no stop message, §2):
// at the deadline, on `:kill`, or when the next run starts. Positions in `loc` are TypeScript
// positions, mapped in the worker through the inline source maps (§4 Running).

/** The §4 deadline when a run names none. */
export const DEFAULT_TIMEOUT_MS = 5000;
/** §4 output caps: after either, one "output truncated" line and nothing more. */
export const MAX_OUTPUT_ENTRIES = 500;
export const MAX_OUTPUT_BYTES = 200_000;
/** §5: each runtime test gets this long. */
export const TEST_TIMEOUT_MS = 1000;

export type RunMode = 'run' | 'test';
/** How the modules were emitted: ES modules loaded by URL, or CommonJS for a cyclic graph (§2 Decisions). */
export type ModuleFormat = 'esm' | 'cjs';

/** One import in an emitted module, resolved to a project path, with the specifier's span in `js`. */
export interface ResolvedImport {
  specifier: string;
  /** The project file it resolves to (`/shapes.ts`). */
  path: string;
  /** 0-based span of the specifier text (quotes excluded) in the module's `js`. */
  start: number;
  end: number;
}

export interface SandboxModule {
  path: string;
  /** JavaScript with an inline source map. */
  js: string;
  imports: ResolvedImport[];
}

export interface RunRequest {
  type: 'run';
  modules: SandboxModule[];
  entry: string;
  mode: RunMode;
  timeoutMs: number;
  format: ModuleFormat;
}

/** A TypeScript position; `line` and `column` are 1-based. */
export interface SourceLoc {
  file: string;
  line: number;
  column: number;
}

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

export type TestStatus = 'pass' | 'fail' | 'timeout' | 'skip';

export type SandboxEvent =
  | {
      type: 'console';
      level: ConsoleLevel;
      /** Each argument serialized in the worker (§4: depth 3, cycle-safe, readable). */
      args: string[];
      loc: SourceLoc | null;
    }
  | {
      type: 'runtimeError';
      message: string;
      stack: string;
      loc: SourceLoc | null;
    }
  | { type: 'truncated'; entries: number; bytes: number }
  | { type: 'testStart'; name: string }
  | {
      type: 'testResult';
      name: string;
      status: TestStatus;
      message?: string;
      expected?: string;
      actual?: string;
      ms: number;
    }
  | {
      type: 'testSummary';
      passed: number;
      failed: number;
      timedOut: number;
      skipped: number;
      ms: number;
    }
  | { type: 'done'; durationMs: number; pendingTimers: number };

export type SandboxEventType = SandboxEvent['type'];

export function isSandboxEvent(value: unknown): value is SandboxEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

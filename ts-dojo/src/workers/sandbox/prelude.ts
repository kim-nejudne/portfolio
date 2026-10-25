// The sandbox prelude (§2: the worker's console shim; §4 Running: serialized entries with their
// source line, the output caps, the deadline's "still running" count). Pure: it installs onto
// whatever global it is given (`self` in worker.ts, a plain object in prelude.test.ts), posts
// through an injected function, and maps stack frames through the module registry built by
// the loader. F7's test harness joins this file.
import {
  MAX_OUTPUT_BYTES,
  MAX_OUTPUT_ENTRIES,
  type ConsoleLevel,
  type SandboxEvent,
  type SourceLoc,
} from '@/protocol/sandbox';
import { formatArgs } from './serialize';
import {
  originalPosition,
  parseInlineSourceMap,
  type DecodedSourceMap,
} from './source-map';

/** A loaded module as the locator needs it: its URL in stack frames and its map. */
export interface LoadedModule {
  url: string;
  path: string;
  js: string;
  /** Generated lines the loader put above the module's own text (the CommonJS wrapper line). */
  lineOffset: number;
}

export interface ModuleRegistry {
  register: (module: LoadedModule) => void;
  /** The TypeScript position of the first stack frame inside a loaded module. */
  locate: (stack: string | undefined) => SourceLoc | null;
}

/** `at blob:http://host/id:3:9`, `at fn (blob:...:3:9)`, `at async ...`, Node's `data:` URLs. */
const FRAME = /((?:blob|data|https?|file):\S+?):(\d+):(\d+)\)?\s*$/;

export function createModuleRegistry(): ModuleRegistry {
  const modules = new Map<
    string,
    LoadedModule & { map: DecodedSourceMap | null }
  >();
  return {
    register(module) {
      modules.set(module.url, {
        ...module,
        map: parseInlineSourceMap(module.js),
      });
    },
    locate(stack) {
      if (stack === undefined) return null;
      for (const line of stack.split('\n')) {
        const match = FRAME.exec(line);
        if (match === null) continue;
        const module = modules.get(match[1] as string);
        if (module === undefined) continue;
        const generatedLine = Number(match[2]) - module.lineOffset;
        const column = Number(match[3]);
        if (module.map === null || generatedLine < 1) {
          return {
            file: module.path,
            line: Math.max(generatedLine, 1),
            column,
          };
        }
        const original = originalPosition(module.map, generatedLine, column);
        if (original === null) return null;
        return {
          file: module.path,
          line: original.line,
          column: original.column,
        };
      }
      return null;
    },
  };
}

type TimerFn = (
  callback: (...args: unknown[]) => void,
  ms?: number,
  ...args: unknown[]
) => number;
type ClearFn = (id: number | undefined) => void;

/** What the prelude replaces on the global. */
export interface SandboxGlobal {
  console?: unknown;
  setTimeout: TimerFn;
  clearTimeout: ClearFn;
  setInterval: TimerFn;
  clearInterval: ClearFn;
}

export interface PreludeOptions {
  global: SandboxGlobal;
  post: (event: SandboxEvent) => void;
  locate: (stack: string | undefined) => SourceLoc | null;
  now?: () => number;
}

export interface Prelude {
  pendingTimers(): number;
  /** An uncaught error: posted as `runtimeError` with its TypeScript position. */
  reportError(error: unknown): void;
  /** The entry module settled: posts `done`; posts it again when the last pending timer drains. */
  settle(): void;
}

const LEVELS: readonly ConsoleLevel[] = [
  'log',
  'info',
  'warn',
  'error',
  'debug',
];

const encoder = new TextEncoder();

function byteLength(text: string): number {
  return encoder.encode(text).length;
}

export function installPrelude(options: PreludeOptions): Prelude {
  const { global, post, locate } = options;
  const now = options.now ?? (() => Date.now());
  const started = now();
  let entries = 0;
  let bytes = 0;
  let truncated = false;
  let settled = false;
  let drained = false;

  const emit = (level: ConsoleLevel, args: unknown[]): void => {
    if (truncated) return;
    const formatted = formatArgs(args);
    const size = byteLength(formatted.join(' '));
    if (entries >= MAX_OUTPUT_ENTRIES || bytes + size > MAX_OUTPUT_BYTES) {
      truncated = true;
      post({ type: 'truncated', entries, bytes });
      return;
    }
    entries += 1;
    bytes += size;
    post({
      type: 'console',
      level,
      args: formatted,
      loc: locate(new Error().stack),
    });
  };
  const shim: Record<string, unknown> = {};
  for (const level of LEVELS) {
    shim[level] = (...args: unknown[]) => {
      emit(level, args);
    };
  }
  Object.defineProperty(global, 'console', {
    value: shim,
    writable: true,
    configurable: true,
  });

  const pending = new Set<number>();
  const afterTimer = (): void => {
    if (settled && !drained && pending.size === 0) {
      drained = true;
      post({ type: 'done', durationMs: now() - started, pendingTimers: 0 });
    }
  };
  const nativeSetTimeout = global.setTimeout;
  const nativeClearTimeout = global.clearTimeout;
  const nativeSetInterval = global.setInterval;
  const nativeClearInterval = global.clearInterval;
  global.setTimeout = (callback, ms, ...args) => {
    const id: number = nativeSetTimeout(
      (...callbackArgs: unknown[]) => {
        pending.delete(id);
        try {
          callback(...callbackArgs);
        } finally {
          afterTimer();
        }
      },
      ms,
      ...args,
    );
    pending.add(id);
    return id;
  };
  global.clearTimeout = (id) => {
    if (id !== undefined) pending.delete(id);
    nativeClearTimeout(id);
    afterTimer();
  };
  global.setInterval = (callback, ms, ...args) => {
    const id: number = nativeSetInterval(callback, ms, ...args);
    pending.add(id);
    return id;
  };
  global.clearInterval = (id) => {
    if (id !== undefined) pending.delete(id);
    nativeClearInterval(id);
    afterTimer();
  };

  return {
    pendingTimers: () => pending.size,
    reportError(error) {
      const stack = error instanceof Error ? error.stack : undefined;
      const message =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : formatArgs([error]).join(' ');
      post({
        type: 'runtimeError',
        message,
        stack: stack ?? '',
        loc: locate(stack),
      });
    },
    settle() {
      if (settled) return;
      settled = true;
      post({
        type: 'done',
        durationMs: now() - started,
        pendingTimers: pending.size,
      });
      if (pending.size === 0) drained = true;
    },
  };
}

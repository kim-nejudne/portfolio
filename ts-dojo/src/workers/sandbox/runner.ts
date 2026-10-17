// The main-thread side of a run (§2 sandbox worker, §4 Running and the output pane, §9): one
// fresh Worker per run, the deadline kept here where a tight loop cannot block it, `kill()`
// for `:kill`, the next `:w` ending the previous run, and a small store of the run's status
// and output entries for the pane. The module graph is resolved here (§2 Decisions): ES
// modules by default, and when the graph has a cycle the project is emitted again as
// CommonJS through the injected `emitCommonJs`. Pure apart from `spawn` and the timers, so
// runner.test.ts drives it with a fake worker.
import {
  DEFAULT_TIMEOUT_MS,
  isSandboxEvent,
  type ConsoleLevel,
  type ModuleFormat,
  type RunMode,
  type RunRequest,
  type SandboxEvent,
  type SandboxModule,
  type SourceLoc,
} from '@/protocol/sandbox';
import type { EmittedFile } from '@/protocol/ts-ls';
import {
  describeCycle,
  describeResolveFailure,
  orderModules,
  resolveModules,
} from './modules';

/** What the runner needs from a Worker (or a test double). */
export interface SandboxWorkerLike {
  postMessage(message: RunRequest): void;
  addEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener: (event: { data?: unknown; message?: string }) => void,
  ): void;
  terminate(): void;
}

export type RunStatus =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | { kind: 'running' }
  | { kind: 'still-running'; pendingTimers: number; durationMs: number }
  | { kind: 'done'; durationMs: number }
  | { kind: 'killed'; afterMs: number; byDeadline: boolean }
  | { kind: 'failed'; message: string };

export type OutputEntry =
  | {
      kind: 'console';
      level: ConsoleLevel;
      text: string;
      loc: SourceLoc | null;
    }
  | { kind: 'error'; message: string; stack: string; loc: SourceLoc | null }
  | { kind: 'truncated'; entries: number; bytes: number };

export interface RunState {
  status: RunStatus;
  entries: OutputEntry[];
  format: ModuleFormat | null;
  /** Counts runs, so the pane can reset its selection when a new one starts. */
  run: number;
}

export interface SandboxRunnerOptions {
  spawn: () => SandboxWorkerLike;
  /** The project emitted as CommonJS, for a cyclic graph. */
  emitCommonJs: (paths: string[]) => Promise<EmittedFile[]>;
  now?: () => number;
}

export interface StartOptions {
  mode?: RunMode;
  timeoutMs?: number;
}

/** Function properties, not methods: React's `useSyncExternalStore` takes `subscribe` unbound. */
export interface SandboxRunner {
  readonly state: RunState;
  subscribe: (listener: () => void) => () => void;
  /** Resolves once the worker has been started (or the run failed before it could). */
  start: (
    modules: EmittedFile[],
    entry: string,
    options?: StartOptions,
  ) => Promise<void>;
  /** Terminates the running sandbox; false when nothing is running. */
  kill: () => boolean;
  isRunning: () => boolean;
  dispose: () => void;
}

const IDLE: RunState = {
  status: { kind: 'idle' },
  entries: [],
  format: null,
  run: 0,
};

export function createSandboxRunner(
  options: SandboxRunnerOptions,
): SandboxRunner {
  const now = options.now ?? (() => performance.now());
  const listeners = new Set<() => void>();
  let state: RunState = IDLE;
  let worker: SandboxWorkerLike | null = null;
  let deadline: ReturnType<typeof setTimeout> | null = null;
  let startedAt = 0;
  let generation = 0;

  const set = (patch: Partial<RunState>): void => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const append = (entry: OutputEntry): void => {
    set({ entries: [...state.entries, entry] });
  };

  const stopWorker = (): void => {
    if (deadline !== null) clearTimeout(deadline);
    deadline = null;
    worker?.terminate();
    worker = null;
  };

  const isRunning = (): boolean =>
    state.status.kind === 'running' || state.status.kind === 'still-running';

  const onEvent = (event: SandboxEvent): void => {
    switch (event.type) {
      case 'console':
        append({
          kind: 'console',
          level: event.level,
          text: event.args.join(' '),
          loc: event.loc,
        });
        return;
      case 'runtimeError':
        append({
          kind: 'error',
          message: event.message,
          stack: event.stack,
          loc: event.loc,
        });
        return;
      case 'truncated':
        append({
          kind: 'truncated',
          entries: event.entries,
          bytes: event.bytes,
        });
        return;
      case 'done':
        if (event.pendingTimers > 0) {
          set({
            status: {
              kind: 'still-running',
              pendingTimers: event.pendingTimers,
              durationMs: event.durationMs,
            },
          });
        } else {
          stopWorker();
          set({ status: { kind: 'done', durationMs: event.durationMs } });
        }
        return;
      case 'testStart':
      case 'testResult':
      case 'testSummary':
        // F7: the Tests tab.
        return;
    }
  };

  const kill = (byDeadline: boolean, afterMs: number): void => {
    stopWorker();
    set({ status: { kind: 'killed', afterMs, byDeadline } });
  };

  const prepare = async (
    modules: EmittedFile[],
  ): Promise<
    { modules: SandboxModule[]; format: ModuleFormat } | { message: string }
  > => {
    const resolved = resolveModules(modules);
    if ('failure' in resolved)
      return { message: describeResolveFailure(resolved.failure) };
    const ordered = orderModules(resolved.modules);
    if ('order' in ordered) return { modules: resolved.modules, format: 'esm' };
    let commonJs: EmittedFile[];
    try {
      commonJs = await options.emitCommonJs(modules.map((m) => m.path));
    } catch (error) {
      return {
        message: `cyclic imports (${describeCycle(ordered.cycle)}) and the CommonJS emit failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
    return {
      modules: commonJs.map((m) => ({ path: m.path, js: m.js, imports: [] })),
      format: 'cjs',
    };
  };

  return {
    get state() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isRunning,
    async start(modules, entry, startOptions = {}) {
      stopWorker();
      generation += 1;
      const mine = generation;
      set({
        status: { kind: 'preparing' },
        entries: [],
        format: null,
        run: state.run + 1,
      });
      const prepared = await prepare(modules);
      if (mine !== generation) return;
      if ('message' in prepared) {
        set({ status: { kind: 'failed', message: prepared.message } });
        return;
      }
      const timeoutMs = startOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const spawned = options.spawn();
      worker = spawned;
      spawned.addEventListener('message', (event) => {
        if (worker !== spawned) return;
        if (isSandboxEvent(event.data)) onEvent(event.data);
      });
      spawned.addEventListener('error', (event) => {
        if (worker !== spawned) return;
        append({
          kind: 'error',
          message: event.message ?? 'the sandbox worker failed',
          stack: '',
          loc: null,
        });
      });
      startedAt = now();
      set({ status: { kind: 'running' }, format: prepared.format });
      spawned.postMessage({
        type: 'run',
        modules: prepared.modules,
        entry,
        mode: startOptions.mode ?? 'run',
        timeoutMs,
        format: prepared.format,
      });
      deadline = setTimeout(() => {
        if (worker === spawned) kill(true, timeoutMs);
      }, timeoutMs);
    },
    kill() {
      if (!isRunning()) return false;
      kill(false, now() - startedAt);
      return true;
    },
    dispose() {
      generation += 1;
      stopWorker();
      listeners.clear();
    },
  };
}

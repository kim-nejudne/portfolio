// The runner with a fake worker and fake timers: the deadline terminates the worker and reads
// "killed after 5 s" (§12 F4 criterion 2), the entries and the error position (criteria 1
// and 3), the ES-module default and the CommonJS fallback for a cycle (criterion 4), the
// truncation entry (criterion 6), "still running (1 timer)", `kill()` and the second `done`
// (criterion 7), and a new run ending the previous one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunRequest, SandboxEvent } from '@/protocol/sandbox';
import type { EmittedFile } from '@/protocol/ts-ls';
import { formatStatus } from '@/app/run-status';
import { createSandboxRunner, type SandboxWorkerLike } from './runner';

interface FakeWorker {
  worker: SandboxWorkerLike;
  posted: RunRequest[];
  emit: (event: SandboxEvent) => void;
  fail: (message: string) => void;
  terminated: () => boolean;
}

function fakeWorker(): FakeWorker {
  const posted: RunRequest[] = [];
  const onMessage: ((event: { data?: unknown }) => void)[] = [];
  const onError: ((event: { message?: string }) => void)[] = [];
  let terminated = false;
  return {
    worker: {
      postMessage: (message) => {
        posted.push(message);
      },
      addEventListener: (type, listener) => {
        if (type === 'message') onMessage.push(listener);
        if (type === 'error') onError.push(listener);
      },
      terminate: () => {
        terminated = true;
      },
    },
    posted,
    emit: (event) => {
      for (const listener of onMessage) listener({ data: event });
    },
    fail: (message) => {
      for (const listener of onError) listener({ message });
    },
    terminated: () => terminated,
  };
}

const file = (path: string, specifiers: string[] = []): EmittedFile => {
  const js = specifiers.map((s) => `import '${s}';`).join('\n');
  return {
    path,
    js,
    imports: specifiers.map((s) => {
      const start = js.indexOf(`'${s}'`) + 1;
      return { specifier: s, start, end: start + s.length };
    }),
  };
};

function setup() {
  const workers: FakeWorker[] = [];
  const emitCommonJs = vi.fn((paths: string[]) =>
    Promise.resolve(
      paths.map((path) => ({ path, js: `require("${path}")`, imports: [] })),
    ),
  );
  let clock = 0;
  const runner = createSandboxRunner({
    spawn: () => {
      const w = fakeWorker();
      workers.push(w);
      return w.worker;
    },
    emitCommonJs,
    now: () => clock,
  });
  const changes = vi.fn();
  runner.subscribe(changes);
  return {
    runner,
    workers,
    emitCommonJs,
    changes,
    tick: (ms: number) => (clock += ms),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createSandboxRunner', () => {
  it('starts a worker with the ES modules and the default deadline', async () => {
    const { runner, workers, emitCommonJs } = setup();
    await runner.start(
      [file('/index.ts', ['./a']), file('/a.ts')],
      '/index.ts',
    );
    expect(workers).toHaveLength(1);
    const request = workers[0]?.posted[0];
    expect(request?.format).toBe('esm');
    expect(request?.timeoutMs).toBe(5000);
    expect(request?.entry).toBe('/index.ts');
    expect(request?.modules[0]?.imports[0]?.path).toBe('/a.ts');
    expect(emitCommonJs).not.toHaveBeenCalled();
    expect(runner.state.status).toEqual({ kind: 'running' });
    expect(runner.state.format).toBe('esm');
    expect(runner.isRunning()).toBe(true);
  });

  it('collects console, error and truncation entries, then done', async () => {
    const { runner, workers } = setup();
    await runner.start([file('/index.ts')], '/index.ts');
    const w = workers[0]!;
    w.emit({
      type: 'console',
      level: 'log',
      args: ['a', '{ b: 1 }'],
      loc: { file: '/index.ts', line: 1, column: 1 },
    });
    w.emit({
      type: 'runtimeError',
      message: 'Error: boom',
      stack: 'x',
      loc: { file: '/index.ts', line: 3, column: 7 },
    });
    w.emit({ type: 'truncated', entries: 500, bytes: 10 });
    w.emit({ type: 'done', durationMs: 12, pendingTimers: 0 });
    expect(runner.state.entries).toEqual([
      {
        kind: 'console',
        level: 'log',
        text: 'a { b: 1 }',
        loc: { file: '/index.ts', line: 1, column: 1 },
      },
      {
        kind: 'error',
        message: 'Error: boom',
        stack: 'x',
        loc: { file: '/index.ts', line: 3, column: 7 },
      },
      { kind: 'truncated', entries: 500, bytes: 10 },
    ]);
    expect(formatStatus(runner.state.status)).toBe('done in 12 ms');
    expect(w.terminated()).toBe(true);
    expect(runner.isRunning()).toBe(false);
  });

  it('terminates the worker at the deadline and reads "killed after 5 s"', async () => {
    const { runner, workers, tick } = setup();
    await runner.start([file('/index.ts')], '/index.ts');
    vi.advanceTimersByTime(4999);
    tick(4999);
    expect(workers[0]?.terminated()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(workers[0]?.terminated()).toBe(true);
    expect(runner.state.status).toEqual({
      kind: 'killed',
      afterMs: 5000,
      byDeadline: true,
    });
    expect(formatStatus(runner.state.status)).toBe('killed after 5 s');
    // A late message from the terminated worker changes nothing.
    workers[0]?.emit({ type: 'done', durationMs: 1, pendingTimers: 0 });
    expect(runner.state.status.kind).toBe('killed');
  });

  it('shows "still running (1 timer)" after done with a pending timer, and kill() ends it', async () => {
    const { runner, workers, tick } = setup();
    await runner.start([file('/index.ts')], '/index.ts');
    workers[0]?.emit({ type: 'done', durationMs: 3, pendingTimers: 1 });
    expect(formatStatus(runner.state.status)).toBe('still running (1 timer)');
    expect(runner.isRunning()).toBe(true);
    tick(412);
    expect(runner.kill()).toBe(true);
    expect(workers[0]?.terminated()).toBe(true);
    expect(runner.state.status).toEqual({
      kind: 'killed',
      afterMs: 412,
      byDeadline: false,
    });
    expect(runner.kill()).toBe(false);
  });

  it('ends "still running" with the second done, and the deadline still applies to it', async () => {
    const { runner, workers } = setup();
    await runner.start([file('/index.ts')], '/index.ts');
    workers[0]?.emit({ type: 'done', durationMs: 3, pendingTimers: 2 });
    workers[0]?.emit({
      type: 'console',
      level: 'log',
      args: ['late'],
      loc: null,
    });
    workers[0]?.emit({ type: 'done', durationMs: 40, pendingTimers: 0 });
    expect(formatStatus(runner.state.status)).toBe('done in 40 ms');
    expect(workers[0]?.terminated()).toBe(true);

    await runner.start([file('/index.ts')], '/index.ts');
    workers[1]?.emit({ type: 'done', durationMs: 3, pendingTimers: 1 });
    vi.advanceTimersByTime(5000);
    expect(workers[1]?.terminated()).toBe(true);
    expect(formatStatus(runner.state.status)).toBe('killed after 5 s');
  });

  it('falls back to CommonJS for a cycle and fails on an import outside the project', async () => {
    const { runner, workers, emitCommonJs } = setup();
    await runner.start(
      [file('/index.ts', ['./a']), file('/a.ts', ['./index'])],
      '/index.ts',
    );
    expect(emitCommonJs).toHaveBeenCalledWith(['/index.ts', '/a.ts']);
    expect(workers[0]?.posted[0]?.format).toBe('cjs');
    expect(workers[0]?.posted[0]?.modules.map((m) => m.js)).toEqual([
      'require("/index.ts")',
      'require("/a.ts")',
    ]);
    expect(runner.state.format).toBe('cjs');

    await runner.start([file('/index.ts', ['lodash'])], '/index.ts');
    expect(workers).toHaveLength(1);
    expect(formatStatus(runner.state.status)).toBe(
      "failed: index.ts imports 'lodash', which is not a file of this project",
    );
  });

  it('ends the previous run when a new one starts and resets the entries', async () => {
    const { runner, workers } = setup();
    await runner.start([file('/index.ts')], '/index.ts');
    workers[0]?.emit({
      type: 'console',
      level: 'log',
      args: ['old'],
      loc: null,
    });
    expect(runner.state.run).toBe(1);
    await runner.start([file('/index.ts')], '/index.ts');
    expect(workers[0]?.terminated()).toBe(true);
    expect(runner.state.entries).toEqual([]);
    expect(runner.state.run).toBe(2);
    workers[0]?.emit({
      type: 'console',
      level: 'log',
      args: ['stale'],
      loc: null,
    });
    expect(runner.state.entries).toEqual([]);
  });

  it('records a worker error event as an error entry', async () => {
    const { runner, workers } = setup();
    await runner.start([file('/index.ts')], '/index.ts');
    workers[0]?.fail('Uncaught SyntaxError');
    expect(runner.state.entries).toEqual([
      { kind: 'error', message: 'Uncaught SyntaxError', stack: '', loc: null },
    ]);
  });

  it('dispose terminates the worker and drops the listeners', async () => {
    const { runner, workers, changes } = setup();
    await runner.start([file('/index.ts')], '/index.ts');
    runner.dispose();
    expect(workers[0]?.terminated()).toBe(true);
    const calls = changes.mock.calls.length;
    workers[0]?.emit({ type: 'console', level: 'log', args: ['x'], loc: null });
    expect(changes.mock.calls.length).toBe(calls);
  });
});

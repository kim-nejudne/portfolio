// Spawns the Node sandbox worker (worker.ts) and presents it as the `SandboxWorkerLike` the
// runner (src/workers/sandbox/runner.ts) drives, so `createSandboxRunner` runs unchanged in
// Node: the same deadline, `kill` and output store as in the browser. The worker is TypeScript
// with `@/` imports, which plain Node cannot load, so the thread is started with tsx's loader
// (`--import tsx`; tsx is the convention of Kim's other repos). Node only: the lint, the tests
// and nothing in the app.
import { Worker } from 'node:worker_threads';
import type { EmittedFile } from '@/protocol/ts-ls';
import {
  createSandboxRunner,
  type SandboxRunner,
  type SandboxWorkerLike,
} from '../runner';

const WORKER_URL = new URL('./worker.ts', import.meta.url);

/**
 * The worker's own Node flags: tsx's loader and nothing else. The parent's `execArgv` is not
 * inherited on purpose: under the tsx CLI it carries `--eval`, under Vitest its own
 * `--require` and `--conditions`, none of which the worker should run with.
 */
const EXEC_ARGV = ['--import', 'tsx'];

export function spawnNodeSandbox(): SandboxWorkerLike {
  const worker = new Worker(WORKER_URL, { execArgv: EXEC_ARGV });
  return {
    postMessage(message) {
      worker.postMessage(message);
    },
    addEventListener(type, listener) {
      if (type === 'message') {
        worker.on('message', (data: unknown) => listener({ data }));
      } else if (type === 'error') {
        worker.on('error', (error: Error) =>
          listener({ message: error.message }),
        );
      } else {
        worker.on('messageerror', (error: Error) =>
          listener({ message: error.message }),
        );
      }
    },
    terminate() {
      void worker.terminate();
    },
  };
}

/** A runner over Node workers; `emitCommonJs` re-emits a cyclic project (the caller owns the core). */
export function createNodeSandboxRunner(
  emitCommonJs: (paths: string[]) => Promise<EmittedFile[]>,
): SandboxRunner {
  return createSandboxRunner({ spawn: spawnNodeSandbox, emitCommonJs });
}

// The sandbox worker for Node (§2: both worker cores run in Node): the same prelude, loader
// and harness as src/workers/sandbox/worker.ts, inside a `worker_threads` Worker, with the
// modules loaded from `data:` URLs instead of blob URLs. The content lint and the tests run
// exercises through it, so a solution passes the lint exactly when it passes in the browser,
// and a hanging test is ended by the runner's deadline (`worker.terminate()`) as in Chrome.
// Started by spawn.ts; never imported by the app.
import { parentPort } from 'node:worker_threads';
import type { RunRequest, SandboxEvent } from '@/protocol/sandbox';
import { installHarness } from '../harness';
import { runModules } from '../loader';
import { createModuleRegistry, installPrelude } from '../prelude';

const port = parentPort;
if (port === null) throw new Error('sandbox worker: no parent port');

function post(event: SandboxEvent): void {
  port?.postMessage(event);
}

function isRunRequest(data: unknown): data is RunRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'run'
  );
}

async function run(request: RunRequest): Promise<void> {
  const registry = createModuleRegistry();
  const prelude = installPrelude({
    // Node's timers return Timeout objects, not numbers; the prelude only stores and passes
    // them back, so the shape is what matters.
    global: globalThis,
    post,
    locate: registry.locate,
    now: () => performance.now(),
  });
  process.on('uncaughtException', (error) => {
    prelude.reportError(error);
  });
  process.on('unhandledRejection', (reason) => {
    prelude.reportError(reason);
  });
  const harness =
    request.mode === 'test'
      ? installHarness({
          global: globalThis,
          post,
        })
      : null;
  try {
    await runModules(request, {
      createUrl: (js) =>
        `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`,
      importModule: (url) => import(url) as Promise<Record<string, unknown>>,
      register: registry.register,
      // The installed zod, the version scripts/copy-packages.ts bundles for the browser.
      packageUrl: (name) => import.meta.resolve(name),
    });
    await harness?.run();
  } catch (error) {
    prelude.reportError(error);
  }
  prelude.settle();
}

port.once('message', (data: unknown) => {
  if (isRunRequest(data)) void run(data);
});

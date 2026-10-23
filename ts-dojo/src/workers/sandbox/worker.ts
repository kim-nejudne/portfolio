// The sandbox Worker entry (§2): one `run` request per worker, the prelude installed on
// `self`, the modules loaded from blob URLs, uncaught errors and rejections reported as
// `runtimeError`, and `done` when the entry settles. In `mode: 'test'` the §5 harness is
// installed first and runs the collected tests once the entry (tests.ts) has evaluated. The UI
// terminates the worker (§2: no stop message); nothing here runs after that.
import { PACKAGES } from '@/protocol/packages';
import type { RunRequest, SandboxEvent } from '@/protocol/sandbox';
import { installHarness } from './harness';
import { runModules } from './loader';
import { createModuleRegistry, installPrelude } from './prelude';

interface WorkerScope {
  postMessage(message: SandboxEvent): void;
  addEventListener(
    type: 'message',
    listener: (event: { data: unknown }) => void,
    options?: { once: boolean },
  ): void;
  addEventListener(
    type: 'error',
    listener: (event: {
      error?: unknown;
      message: string;
      preventDefault(): void;
    }) => void,
  ): void;
  addEventListener(
    type: 'unhandledrejection',
    listener: (event: { reason: unknown; preventDefault(): void }) => void,
  ): void;
}

const scope = self as unknown as WorkerScope;

function isRunRequest(data: unknown): data is RunRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'run'
  );
}

/** A pre-bundled package's ES module (/packages/zod-<version>.js, §12 F14), as an absolute URL for blob modules. */
function packageUrl(name: string): string {
  const url = PACKAGES.find((p) => p.name === name)?.runtimeUrl ?? null;
  if (url === null) throw new Error(`${name} has no bundled runtime`);
  return new URL(url, self.location.origin).href;
}

async function run(request: RunRequest): Promise<void> {
  const registry = createModuleRegistry();
  const prelude = installPrelude({
    global: self,
    post: (event) => {
      scope.postMessage(event);
    },
    locate: registry.locate,
  });
  scope.addEventListener('error', (event) => {
    event.preventDefault();
    prelude.reportError(event.error ?? event.message);
  });
  scope.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    prelude.reportError(event.reason);
  });
  const harness =
    request.mode === 'test'
      ? installHarness({
          global: self as unknown as Record<string, unknown>,
          post: (event) => {
            scope.postMessage(event);
          },
        })
      : null;
  try {
    await runModules(request, {
      createUrl: (js) =>
        URL.createObjectURL(new Blob([js], { type: 'text/javascript' })),
      importModule: (url) =>
        import(/* @vite-ignore */ url) as Promise<Record<string, unknown>>,
      register: registry.register,
      packageUrl,
    });
    await harness?.run();
  } catch (error) {
    prelude.reportError(error);
  }
  prelude.settle();
}

scope.addEventListener(
  'message',
  (event) => {
    if (isRunRequest(event.data)) void run(event.data);
  },
  { once: true },
);

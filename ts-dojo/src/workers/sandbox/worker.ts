// The sandbox Worker entry (§2): one `run` request per worker, the prelude installed on
// `self`, the modules loaded from blob URLs, uncaught errors and rejections reported as
// `runtimeError`, and `done` when the entry settles. The UI terminates the worker (§2: no
// stop message); nothing here runs after that.
import type { RunRequest, SandboxEvent } from '@/protocol/sandbox';
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
  try {
    await runModules(request, {
      createUrl: (js) =>
        URL.createObjectURL(new Blob([js], { type: 'text/javascript' })),
      importModule: (url) =>
        import(/* @vite-ignore */ url) as Promise<Record<string, unknown>>,
      register: registry.register,
    });
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

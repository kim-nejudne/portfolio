// The one ts-ls client for the app's lifetime (§2: one worker, started on load; §9 Warm-up:
// an empty project with the default options opens at once, so the first lesson's diagnostics
// are immediate). main.tsx starts it before the first render; pages reach it with getCompiler()
// and the header chip follows its status with useCompilerStatus(). The first `ready` sets the
// §9 budget mark (./marks.ts).
import { useSyncExternalStore } from 'react';
import {
  createTsLsClient,
  type CompilerStatus,
  type TsLsClient,
} from '@/workers/ts-ls/client';
import { COMPILER_READY_MARK, markOnce } from './marks';

let client: TsLsClient | null = null;

export function startCompiler(): TsLsClient {
  if (client === null) {
    client = createTsLsClient({
      spawn: () =>
        new Worker(new URL('../workers/ts-ls/worker.ts', import.meta.url), {
          type: 'module',
        }),
      onError: (error) => {
        console.error('[ts-ls]', error);
      },
    });
    // §9 Budgets: the first `ready`.
    client.whenReady().then(
      () => markOnce(COMPILER_READY_MARK),
      () => undefined,
    );
  }
  return client;
}

export function getCompiler(): TsLsClient {
  return startCompiler();
}

export function useCompilerStatus(): CompilerStatus {
  const compiler = startCompiler();
  return useSyncExternalStore(
    compiler.subscribe,
    () => compiler.status,
    () => compiler.status,
  );
}

// The §5 verdict's `VerifyCore` over the browser's ts-ls client (§2): `:test` on a lesson page
// asks the one worker that already holds the exercise's project. `openProject` sends nothing:
// the editor opened this project with the exercise's options, libs and `.d.ts` files and sends
// every edit with `updateFile` as it happens, so the worker has the live texts; opening it
// again would reject the editor's own requests in flight (`ProjectChangedError`) and restart
// every version at 0. The other requests forward and unwrap the payloads.
import type { TsLsClient } from '@/workers/ts-ls/client';
import type { VerifyCore } from './exercise';

export function verifyCoreOverClient(client: TsLsClient): VerifyCore {
  return {
    openProject: () => undefined,
    async getDiagnostics(paths) {
      const { diagnostics } = await client.getDiagnostics(paths);
      return { diagnostics };
    },
    runTypeTests: (paths) => client.runTypeTests(paths),
    async lintAst(paths, rules) {
      return { hits: await client.lintAst(paths, rules) };
    },
    async emit(paths, module) {
      return { files: await client.emit(paths, module) };
    },
  };
}

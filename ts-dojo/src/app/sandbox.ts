// The app's sandbox runner (§2: a fresh dedicated Worker per run). One per page that hosts an
// editor (/repl now, the lesson page at F8); the CommonJS fallback for cyclic imports goes
// through the one ts-ls client.
import {
  createSandboxRunner,
  type SandboxRunner,
} from '@/workers/sandbox/runner';
import { getCompiler } from './compiler';

export function createAppSandboxRunner(): SandboxRunner {
  return createSandboxRunner({
    spawn: () =>
      new Worker(new URL('../workers/sandbox/worker.ts', import.meta.url), {
        type: 'module',
      }),
    emitCommonJs: (paths) => getCompiler().emit(paths, 'commonjs'),
  });
}

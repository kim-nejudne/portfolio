// §12 F2: "getDiagnostics on a 200-line fixture returns in under 300 ms p95 after warm-up,
// measured by a Vitest benchmark on the core module." Vitest 5's `bench` is a test-context
// fixture that runs under `vitest bench` (`pnpm bench`); core.test.ts asserts the same number
// inside `pnpm test --run`. Warm-up: init (the es2025 libs parsed), the fixture project open,
// one diagnostics pass; then each iteration edits one line and asks again, the §4 cycle.
import { expect, test } from 'vitest';
import { createTsLsCore } from './core';
import { nodeFetchLib, readFixture } from './node/fetch-lib';

const FIXTURE = readFixture('two-hundred-lines.ts.txt');

test('§12 F2: getDiagnostics on a 200-line fixture, warm, under 300 ms p95', async ({
  bench,
}) => {
  const core = createTsLsCore({ fetchLib: nodeFetchLib });
  await core.init();
  await core.openProject({ files: [{ path: '/index.ts', text: FIXTURE }] });
  expect(core.getDiagnostics(['/index.ts']).diagnostics).toEqual([]);

  let version = 0;
  const result = await bench(
    'getDiagnostics after an edit, 200 lines, es2025 lib',
    // The full result (samples included) lands in the gitignored test-results/ for the record.
    { writeResult: 'test-results/ts-ls-diagnostics.bench.json' },
    () => {
      version += 1;
      core.updateFile(
        '/index.ts',
        FIXTURE.replace('revision = 0', `revision = ${String(version)}`),
        version,
      );
      core.getDiagnostics(['/index.ts']);
    },
  ).run({ iterations: 50, warmupIterations: 5, retainSamples: true });

  const samples = result.latency.samples;
  if (samples === undefined) throw new Error('retainSamples kept no samples');
  const sorted = [...samples].sort((a, b) => a - b);
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] as number;
  const summary = `getDiagnostics, 200 lines, warm: p50 ${result.latency.p50.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, p99 ${result.latency.p99.toFixed(1)} ms, mean ${result.latency.mean.toFixed(1)} ms, max ${result.latency.max.toFixed(1)} ms over ${sorted.length} samples (budget: p95 under 300 ms)`;
  console.info(summary);
  expect(p95, summary).toBeLessThan(300);
  core.dispose();
});

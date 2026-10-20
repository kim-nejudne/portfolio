// `pnpm content:lint` (spec §3 Content lint, §2 Build): proves every lesson under content/
// with the app's own compiler and sandbox modules, in Node. Prints one line per exercise with
// the groups that passed, then every failure with its §3 condition, and exits 1 on any failure.
// Runs in CI before the build and in deploy.sh before shipping. Optional arguments narrow the
// run to ids: `pnpm content:lint m03-unions m04-objects/02-structural-typing`.
// `--root=<dir>` lints another content directory (the tests point it at a mutated copy).
// Runs under tsx (the `@/` alias and extensionless imports of the app's modules).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatExerciseLine, lintContent } from '../src/content/node/lint';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'content');

async function main(argv: string[]): Promise<number> {
  const only = argv.filter((arg) => !arg.startsWith('-'));
  const root =
    argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ??
    CONTENT;
  const started = performance.now();
  const report = await lintContent(root, {
    ...(only.length > 0 ? { only } : {}),
    onExercise: (exercise) => {
      console.log(formatExerciseLine(exercise));
    },
  });
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  if (report.lessons.length > 0) {
    console.log(
      `${String(report.lessons.length)} lesson${report.lessons.length === 1 ? '' : 's'}, ${String(report.exercises.length)} editor exercise${report.exercises.length === 1 ? '' : 's'} checked in ${seconds} s`,
    );
  }
  if (report.failures.length === 0) {
    console.log('content lint: ok');
    return 0;
  }
  console.error(
    `content lint: ${String(report.failures.length)} failure${report.failures.length === 1 ? '' : 's'}`,
  );
  for (const failure of report.failures) {
    console.error(
      `  ${failure.path}: ${failure.message} (§3 condition ${String(failure.condition)})`,
    );
  }
  return 1;
}

process.exitCode = await main(process.argv.slice(2));

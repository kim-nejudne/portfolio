#!/usr/bin/env node
// PreToolUse hook for Bash that acts only when the command contains `git commit`.
// Before the commit it runs the repo's checks, in this order and only for the scripts that
// exist in package.json: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test --run`.
// The first failure blocks the commit (exit 2) and shows the last lines of output. Before
// package.json exists (Prep, early F1) it skips and says so, so the workflow works from the
// first commit. On success it reports what passed as a one-line systemMessage.

import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  block,
  emit,
  gitSubcommand,
  innerCommands,
  projectRoot,
  readInput,
  readScripts,
  run,
  splitSegments,
  tail,
  unwrap,
} from './lib.mts';

const CHECKS: { name: string; args: string[]; capMs: number }[] = [
  { name: 'typecheck', args: ['typecheck'], capMs: 240_000 },
  { name: 'lint', args: ['lint'], capMs: 180_000 },
  { name: 'format:check', args: ['format:check'], capMs: 120_000 },
  { name: 'test', args: ['test', '--run'], capMs: 300_000 },
];
const TOTAL_BUDGET_MS = 570_000; // the hook itself is cut off at 600 s

/** True when any simple command in the text is `git [opts] commit ...` that would create a commit. */
function isCommit(text: string, depth = 0): boolean {
  if (depth > 4) return false;
  for (const segment of splitSegments(text)) {
    const words = unwrap(segment);
    if (words.length > 0 && path.basename(words[0] as string) === 'git') {
      const { sub, rest } = gitSubcommand(words);
      if (sub === 'commit' && !rest.some((a) => ['--help', '-h', '--dry-run'].includes(a))) return true;
    }
    for (const word of segment) {
      if (innerCommands(word).some((inner) => isCommit(inner, depth + 1))) return true;
    }
  }
  return false;
}

function main(): void {
  const input = readInput();
  const command = input.tool_input?.command;
  if (typeof command !== 'string' || !isCommit(command)) return;

  const root = projectRoot(input);
  const scripts = readScripts(root);
  if (scripts === null) {
    emit({ systemMessage: 'pre-commit: no package.json yet, so typecheck, lint, format:check and tests were skipped.' });
    return;
  }
  const checks = CHECKS.filter((c) => c.name in scripts);
  if (checks.length === 0) {
    emit({ systemMessage: 'pre-commit: package.json defines none of typecheck, lint, format:check or test yet; skipped.' });
    return;
  }
  if (!existsSync(path.join(root, 'node_modules'))) {
    block('pre-commit: package.json defines checks but node_modules is missing. Run `pnpm install`, then commit again.');
  }

  const started = Date.now();
  for (const check of checks) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (remaining <= 0) block(`pre-commit: out of time before \`pnpm ${check.name}\` could run. Run it yourself, then commit again.`);
    const result = run('pnpm', ['-s', ...check.args], { cwd: root, timeoutMs: Math.min(check.capMs, remaining) });
    if (!result.ok) {
      block(
        [
          `pre-commit: \`pnpm ${check.args.join(' ')}\` ${result.timedOut ? 'timed out' : 'failed'}; the commit is blocked.`,
          '--- last 40 lines ---',
          tail(result.output, 40),
          'Fix it, then commit again. If you are stopping to ask Kim, say so instead of committing.',
        ].join('\n'),
      );
    }
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  emit({ systemMessage: `pre-commit: ${checks.map((c) => c.name).join(', ')} passed in ${seconds} s.` });
}

try {
  main();
} catch (err) {
  // Fail closed: an internal error must not let an unchecked commit through.
  block(`pre-commit.mts hit an internal error (${(err as Error).message}); the commit is blocked. Fix the hook or run the checks by hand.`);
}

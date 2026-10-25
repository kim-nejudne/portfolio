#!/usr/bin/env node
// Stop hook: when Claude finishes a turn with uncommitted changes under src/, content/ or
// scripts/, run `pnpm typecheck` and, if it fails, send Claude back to fix it (exit 2 with
// the last lines of output). It stays quiet when nothing under those folders changed, when
// there is no git repo, package.json, typecheck script or node_modules yet, and it never
// loops: when stop_hook_active is true Claude is already continuing because of this hook,
// so it exits 0 at once (Claude Code also caps consecutive continuations at 8).

import { existsSync } from 'node:fs';
import path from 'node:path';
import { block, projectRoot, readInput, readScripts, run, tail } from './lib.mts';

const WATCHED = ['src', 'content', 'scripts'];

const input = readInput();
if (input.stop_hook_active !== true) {
  const root = projectRoot(input);
  const scripts = readScripts(root);
  const dirs = WATCHED.filter((d) => existsSync(path.join(root, d)));
  const ready =
    existsSync(path.join(root, '.git')) &&
    scripts !== null &&
    'typecheck' in scripts &&
    existsSync(path.join(root, 'node_modules')) &&
    dirs.length > 0;
  if (ready) {
    const status = run('git', ['status', '--porcelain', '--', ...dirs], { cwd: root, timeoutMs: 10_000 });
    if (status.ok && status.output.trim() !== '') {
      const result = run('pnpm', ['-s', 'typecheck'], { cwd: root, timeoutMs: 240_000 });
      if (!result.ok) {
        block(
          [
            `Stop hook: \`pnpm typecheck\` ${result.timedOut ? 'timed out' : 'failed'} with changes under ${dirs.join(', ')}. Fix it before finishing.`,
            '(If you are stopping to ask Kim something, say so and stop again; this hook will not block twice.)',
            '--- last 40 lines ---',
            tail(result.output, 40),
          ].join('\n'),
        );
      }
    }
  }
}

#!/usr/bin/env node
// PostToolUse hook for Edit, Write, MultiEdit and NotebookEdit: formats the edited file
// with the repo's own Prettier (node_modules/.bin/prettier), run from the repo root so
// .prettierrc and .prettierignore apply. Only .ts .tsx .mts .cts .mdx .yaml .yml .json
// files inside the repo; never node_modules, dist or lockfiles; never .md, so docs/spec.md
// is never touched. It skips silently when Prettier isn't installed yet (Prep, early F1).
// A PostToolUse hook can't block anything (the edit already happened): exit 2 only reports
// a Prettier parse error to Claude, which means the file it just wrote has broken syntax.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { block, projectRoot, readInput, realPath, run } from './lib.mts';

const EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.mdx', '.yaml', '.yml', '.json']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'playwright-report', 'test-results']);
const SKIP_FILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']);

const input = readInput();
const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (typeof target === 'string' && target !== '') {
  const root = realPath(projectRoot(input));
  const file = realPath(path.isAbsolute(target) ? target : path.join(input.cwd ?? root, target));
  const rel = path.relative(root, file);
  const inside = rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  const firstDir = rel.split(path.sep)[0] as string;
  const prettier = path.join(root, 'node_modules', '.bin', 'prettier');
  if (
    inside &&
    EXTENSIONS.has(path.extname(file)) &&
    !SKIP_DIRS.has(firstDir) &&
    !SKIP_FILES.has(path.basename(file)) &&
    existsSync(file) &&
    existsSync(prettier)
  ) {
    const result = run(prettier, ['--write', '--log-level', 'warn', file], { cwd: root, timeoutMs: 25_000 });
    if (!result.ok) block(`Prettier could not format ${rel}:\n${result.output.trim()}`);
  }
}

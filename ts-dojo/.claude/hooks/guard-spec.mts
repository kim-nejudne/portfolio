#!/usr/bin/env node
// PreToolUse hook for Edit, Write, MultiEdit and NotebookEdit. Blocks (exit 2) any change
// to docs/spec.md: the spec is Kim's and Claude never edits it. Proposed changes go under
// "Spec questions" in docs/progress.md instead. Everything else passes (exit 0).

import path from 'node:path';
import { block, projectRoot, readInput, realPath } from './lib.mts';

const input = readInput();
const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (typeof target === 'string' && target !== '') {
  const root = projectRoot(input);
  const spec = realPath(path.join(root, 'docs', 'spec.md'));
  const file = realPath(path.isAbsolute(target) ? target : path.join(input.cwd ?? root, target));
  if (file === spec) {
    block(
      [
        'Blocked by .claude/hooks/guard-spec.mts: docs/spec.md is Kim\'s and is never edited by Claude.',
        'Write the proposed change, with the section number and the reason, under "Spec questions" in docs/progress.md,',
        'and carry on with the spec as written until Kim answers.',
      ].join('\n'),
    );
  }
}

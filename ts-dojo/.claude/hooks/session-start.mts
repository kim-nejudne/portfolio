#!/usr/bin/env node
// SessionStart hook (startup, resume, clear). Prints the current feature and its unchecked
// §12 criteria from docs/progress.md, how many items wait on Kim, and `git status --short`.
// Plain stdout from a SessionStart hook is added to Claude's context, so this is what a
// new session knows before its first message. The current feature is the first section, in
// the file's order (the §11 build order), with an unchecked item that is not tagged
// "(by hand" or "(droplet)". Never fails: with no progress.md or no git repo it says so.

import { existsSync, readFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { projectRoot, readInput, run } from './lib.mts';

const MAX_ITEMS = 20;
const MAX_STATUS_LINES = 30;

interface Section {
  title: string;
  unchecked: string[];
}

function sections(markdown: string): Section[] {
  const out: Section[] = [];
  let current: Section | null = null;
  for (const line of markdown.split('\n')) {
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      current = { title: (heading[1] as string).trim(), unchecked: [] };
      out.push(current);
    } else if (current && /^\s*- \[ \] /.test(line)) {
      current.unchecked.push(line.trim());
    }
  }
  return out;
}

const forKim = (item: string): boolean => /\((by hand|droplet)/i.test(item);
const isFeature = (title: string): boolean => /^(Prep|F\d+\b|v1 gate)/.test(title);

const lines: string[] = ['ts-dojo session start (from .claude/hooks/session-start.mts)'];
const input = readInput();
const root = projectRoot(input);
const progressFile = path.join(root, 'docs', 'progress.md');

if (!existsSync(progressFile)) {
  lines.push('docs/progress.md is missing: create it from spec §12 before building anything.');
} else {
  const features = sections(readFileSync(progressFile, 'utf8')).filter((s) => isFeature(s.title));
  const current = features.find((s) => s.unchecked.some((i) => !forKim(i)));
  const waiting = features.reduce((n, s) => n + s.unchecked.filter(forKim).length, 0);
  if (current) {
    const items = current.unchecked.filter((i) => !forKim(i));
    lines.push(`Current feature: ${current.title} (${items.length} unchecked, ${features.indexOf(current) + 1}/${features.length} in build order)`);
    lines.push(...items.slice(0, MAX_ITEMS));
    if (items.length > MAX_ITEMS) lines.push(`... and ${items.length - MAX_ITEMS} more in docs/progress.md`);
  } else {
    lines.push('Every automatable §12 criterion is ticked.');
  }
  lines.push(`Waiting on Kim (by hand or droplet): ${waiting} item${waiting === 1 ? '' : 's'}; see "For Kim" in docs/progress.md.`);
}

if (!existsSync(path.join(root, '.git'))) {
  lines.push('git: not a repository yet.');
} else {
  const status = run('git', ['status', '--short'], { cwd: root, timeoutMs: 10_000 });
  const entries = status.output.trimEnd().split('\n').filter((l) => l !== '');
  if (!status.ok) lines.push('git status: failed to run.');
  else if (entries.length === 0) lines.push('git status --short: clean.');
  else {
    lines.push('git status --short:');
    lines.push(...entries.slice(0, MAX_STATUS_LINES));
    if (entries.length > MAX_STATUS_LINES) lines.push(`... and ${entries.length - MAX_STATUS_LINES} more`);
  }
}

writeSync(1, `${lines.join('\n')}\n`);

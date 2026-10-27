// SessionStart: print a short project briefing that becomes Claude's context.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const LINE = /^\s*- \[( |~|x|!)\] ([FB]\d+[a-z]?)\s+(.*)$/;

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).trim();
  } catch {
    return null;
  }
}

try {
  readStdin();
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const out = [];

  const roadmapPath = join(root, 'docs', 'ROADMAP.md');
  if (existsSync(roadmapPath)) {
    const items = [];
    for (const line of readFileSync(roadmapPath, 'utf8').split(/\r?\n/)) {
      const m = LINE.exec(line);
      if (m) items.push({ mark: m[1], id: m[2], title: m[3].trim() });
    }
    const features = items.filter((i) => i.id.startsWith('F'));
    const done = features.filter((i) => i.mark === 'x').length;
    out.push(`Roadmap: ${done}/${features.length} features done`);
    for (const i of items.filter((i) => i.mark === '~')) out.push(`In progress: ${i.id} ${i.title}`);
    for (const i of items.filter((i) => i.mark === '!')) out.push(`BLOCKED: ${i.id} ${i.title} (see note in ROADMAP.md)`);
    const openBugs = items.filter((i) => i.id.startsWith('B') && i.mark === ' ');
    if (openBugs.length) out.push(`Open bugs: ${openBugs.map((i) => i.id).join(', ')}`);
    const next = features.find((i) => i.mark === ' ');
    out.push(next ? `Next todo: ${next.id} ${next.title}` : 'Next todo: none');
  } else {
    out.push('Roadmap: docs/ROADMAP.md not found');
  }

  const progressPath = join(root, 'docs', 'PROGRESS.md');
  if (existsSync(progressPath)) {
    const text = readFileSync(progressPath, 'utf8');
    const marker = text.indexOf('<!-- entries below, newest first -->');
    const body = marker >= 0 ? text.slice(marker).split(/\r?\n/).slice(1) : [];
    const start = body.findIndex((l) => l.startsWith('## '));
    if (start >= 0) {
      const entry = [];
      for (let k = start; k < body.length; k++) {
        if (k > start && body[k].startsWith('## ')) break;
        entry.push(body[k]);
      }
      while (entry.length && entry[entry.length - 1].trim() === '') entry.pop();
      out.push('Latest progress entry:');
      out.push(...entry.slice(0, 15));
    } else {
      out.push('Latest progress entry: none yet');
    }
  }

  // buzzer/ lives inside the portfolio monorepo, so git output is scoped to this directory.
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], root);
  if (branch === null) {
    out.push('Git: not a repository');
  } else {
    const status = git(['status', '--porcelain', '--untracked-files=all', '--', '.'], root) ?? '';
    const changed = status ? status.split(/\r?\n/).filter(Boolean).length : 0;
    const last = git(['log', '-1', '--format=%h %s', '--', '.'], root) || 'no commits yet';
    out.push(`Git: branch ${branch}, ${changed} uncommitted file(s) in buzzer/, last commit: ${last}`);
  }

  out.push('Workflow: /next-feature builds the next feature. Also: /fix-bug, /add-feature, /verify, /playtest.');
  process.stdout.write(out.slice(0, 30).join('\n') + '\n');
} catch {
  // Never block a session on a briefing failure.
}
process.exit(0);

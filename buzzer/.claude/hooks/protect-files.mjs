// PreToolUse (Edit|Write): block edits to owner-controlled and generated files.
import { readFileSync, existsSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

function normalise(filePath, root) {
  let p = String(filePath).replace(/\\/g, '/');
  if (isAbsolute(p) || /^[A-Za-z]:\//.test(p)) {
    p = relative(root, resolve(p)).replace(/\\/g, '/');
  }
  return p.replace(/^\.\//, '');
}

function block(reason) {
  process.stderr.write(reason + '\n');
  process.exit(2);
}

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

try {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const filePath = input?.tool_input?.file_path;
  if (!filePath) process.exit(0);

  const rel = normalise(filePath, root);
  const segments = rel.split('/');
  const base = segments[segments.length - 1];

  if (rel.toLowerCase() === 'docs/spec.md' && !existsSync(resolve(root, '.claude/spec-unlocked'))) {
    block(
      'SPEC.md is owner-controlled. Propose changes in docs/DECISIONS.md. Only the user may unlock it by creating .claude/spec-unlocked; never create that file yourself.',
    );
  }
  if (base === '.env' || base.startsWith('.env.')) {
    block(`${rel}: .env files hold secrets and are off-limits. Ask the user to edit it.`);
  }
  if (base === 'package-lock.json') {
    block(`${rel}: package-lock.json changes only through npm (npm install / npm uninstall).`);
  }
  if (segments.includes('.git')) {
    block(`${rel}: files inside .git/ are never edited directly. Use git commands.`);
  }
} catch {
  // Never crash the tool call on a hook bug.
}
process.exit(0);

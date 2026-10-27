// PostToolUse (Edit|Write): run Prettier on the one file just written.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isAbsolute, join, relative, resolve } from 'node:path';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.json', '.css', '.md'];

try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const filePath = input?.tool_input?.file_path;
  if (!filePath) process.exit(0);

  let rel = String(filePath).replace(/\\/g, '/');
  if (isAbsolute(rel) || /^[A-Za-z]:\//.test(rel)) rel = relative(root, resolve(rel)).replace(/\\/g, '/');
  // Only format files inside this project; the rest of the monorepo has its own tooling.
  if (rel.startsWith('../') || !EXTENSIONS.some((ext) => rel.endsWith(ext))) process.exit(0);

  const prettier = join(root, 'node_modules', '.bin', 'prettier');
  if (!existsSync(prettier)) process.exit(0);

  const win = process.platform === 'win32';
  execFileSync(win ? `${prettier}.cmd` : prettier, ['--write', '--log-level', 'warn', rel], {
    cwd: root,
    stdio: 'ignore',
    timeout: 10000,
    shell: win,
  });
} catch {
  // Formatting is best-effort; verify's format:check is the gate.
}
process.exit(0);

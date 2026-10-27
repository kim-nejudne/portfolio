// Stop: refuse to finish while changed TypeScript fails to typecheck.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';

try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  if (input.stop_hook_active === true) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) process.exit(0);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (!pkg?.scripts?.typecheck) process.exit(0);

  // Scoped to buzzer/: the git root is the portfolio monorepo.
  let status = '';
  try {
    status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', '.'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
  } catch {
    process.exit(0);
  }
  const tsChanged = status
    .split(/\r?\n/)
    .filter(Boolean)
    .some((line) => /\.tsx?"?$/.test(line.trim()));
  if (!tsChanged) process.exit(0);

  const win = process.platform === 'win32';
  const result = spawnSync(win ? 'npm.cmd' : 'npm', ['run', 'typecheck'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 110000,
    shell: win,
  });
  if (result.status === 0) process.exit(0);
  if (result.error) process.exit(0);

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.split(/\r?\n/);
  process.stderr.write(output.slice(-40).join('\n') + '\nFix these type errors before finishing.\n');
  process.exit(2);
} catch {
  process.exit(0);
}

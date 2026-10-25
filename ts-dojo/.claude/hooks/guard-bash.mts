#!/usr/bin/env node
// PreToolUse hook for Bash. Exit 2 blocks the command; stderr tells Claude why.
// It looks at each simple command (wrappers like sudo, env and rtk stripped; quoted
// strings and heredoc bodies are not read as commands) and blocks:
//   1. npm, npx and yarn: this repo is pnpm-only (spec §2).
//   2. ssh, certbot, and scp or rsync with a remote target: never touch the droplet (CLAUDE.md).
//   3. Running deploy/deploy.sh: Kim runs the deploy by hand.
//   4. git push with a force flag (--force, -f, --force-with-lease, --force-if-includes, --mirror, +refspec).
//   5. Shell writes to docs/spec.md (> >> tee, sed -i, rm, mv/cp onto it, git checkout/restore of it): the spec is Kim's.
// Defence in depth, not a sandbox: a command the tokenizer can't handle falls back to
// pattern checks, and an internal error blocks the command rather than letting it through.

import path from 'node:path';
import { block, gitSubcommand, innerCommands, readInput, splitSegments, unwrap } from './lib.mts';

const PNPM_ONLY = 'this repo is pnpm-only (spec §2): use `pnpm <script>`, `pnpm add`, `pnpm dlx` instead';
const DROPLET = 'never touch the droplet from here; write the config or script and Kim runs it (CLAUDE.md)';
const SPEC =
  'docs/spec.md is Kim\'s and is never edited by Claude; propose the change under "Spec questions" in docs/progress.md';

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);
const REMOTE_PATH = /^(?:[\w.-]+@)?[\w.-]+:(?!\/\/)/; // user@host:path or host:path
const REMOTE_URL = /^(?:rsync|scp|sftp|ssh):\/\//;
const MAX_DEPTH = 4;

function isSpecFile(word: string): boolean {
  const norm = word.replace(/^\.\//, '').replace(/\/+$/, '');
  return norm === 'docs/spec.md' || norm.endsWith('/docs/spec.md') || norm === 'spec.md';
}

function isForceFlag(word: string): boolean {
  if (['--force', '-f', '--force-if-includes', '--mirror'].includes(word)) return true;
  if (word.startsWith('--force-with-lease') || word.startsWith('--force=')) return true;
  if (/^-[a-zA-Z]*f[a-zA-Z]*$/.test(word)) return true; // -uf, -fu
  return word.length > 1 && word.startsWith('+'); // +refspec
}

function hasInPlaceFlag(args: string[]): boolean {
  return args.some((a) => /^-[a-zA-Z]*i/.test(a) || a === '--in-place' || a.startsWith('--in-place='));
}

function checkSegment(raw: string[], depth: number): string[] {
  const words = unwrap(raw);
  if (words.length === 0) return [];
  const reasons: string[] = [];
  const name = path.basename(words[0] as string);
  const args = words.slice(1);
  const operands = args.filter((a) => !a.startsWith('-') && !/^[<>]/.test(a));

  // 1. package managers
  if (name === 'npm' || name === 'npx' || name === 'yarn') reasons.push(`\`${name}\`: ${PNPM_ONLY}`);

  // 2. the droplet
  if (name === 'ssh') reasons.push(`\`ssh\`: ${DROPLET}`);
  if (name === 'certbot') reasons.push(`\`certbot\`: ${DROPLET}`);
  if (name === 'scp' || name === 'rsync') {
    const remote =
      operands.some((a) => REMOTE_PATH.test(a) || REMOTE_URL.test(a)) ||
      args.some((a) => a === '-e' || a.startsWith('--rsh'));
    if (remote) reasons.push(`\`${name}\` to a remote host: ${DROPLET}`);
  }

  // 3. the deploy script
  const runsDeploy =
    name === 'deploy.sh' ||
    ((SHELLS.has(name) || name === 'source' || name === '.') &&
      operands.length > 0 &&
      path.basename(operands[0] as string) === 'deploy.sh');
  if (runsDeploy) reasons.push(`running deploy/deploy.sh: ${DROPLET}`);

  // 4. force push
  let gitSub: string | null = null;
  if (name === 'git') {
    const { sub, rest } = gitSubcommand(words);
    gitSub = sub;
    if (sub === 'push' && rest.some(isForceFlag)) {
      reasons.push('`git push` with a force flag rewrites remote history; ask Kim');
    }
  }

  // 5. writes to docs/spec.md
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i] as string;
    if ((w === '>' || w === '>>') && isSpecFile(words[i + 1] as string)) {
      reasons.push(`redirecting output into docs/spec.md: ${SPEC}`);
    }
  }
  if (operands.some(isSpecFile)) {
    const lastOperand = operands[operands.length - 1] as string;
    const writes =
      ((name === 'sed' || name === 'perl') && hasInPlaceFlag(args)) ||
      ['tee', 'rm', 'truncate', 'patch', 'dd', 'shred'].includes(name) ||
      (['mv', 'cp', 'install', 'ln'].includes(name) && isSpecFile(lastOperand)) ||
      (name === 'git' && ['checkout', 'restore', 'rm', 'mv', 'apply'].includes(gitSub ?? ''));
    if (writes) reasons.push(`\`${name}\` would change docs/spec.md: ${SPEC}`);
  }

  // Command strings handed to a shell or eval are commands too.
  if (SHELLS.has(name)) {
    const c = args.indexOf('-c');
    if (c !== -1 && args[c + 1] !== undefined) reasons.push(...analyze(args[c + 1] as string, depth + 1));
  } else if (name === 'eval') {
    reasons.push(...analyze(args.join(' '), depth + 1));
  }
  return reasons;
}

/** Pattern checks for a command the tokenizer couldn't handle. */
function fallback(text: string): string[] {
  const reasons: string[] = [];
  const m = text.match(/(?:^|[\s;&|(`])(npm|npx|yarn)(?=\s|$)/);
  if (m) reasons.push(`\`${m[1]}\`: ${PNPM_ONLY}`);
  if (/(?:^|[\s;&|(`])(ssh|certbot)(?=\s|$)/.test(text)) reasons.push(`ssh or certbot: ${DROPLET}`);
  if (/(?:^|[\s;&|(`/])deploy\.sh(?=\s|$)/.test(text)) reasons.push(`running deploy.sh: ${DROPLET}`);
  if (/\bgit\b[^;&|]*\bpush\b[^;&|]*(?:\s--force|\s-[a-zA-Z]*f[a-zA-Z]*\b|\s\+\S|--mirror)/.test(text)) {
    reasons.push('`git push` with a force flag rewrites remote history; ask Kim');
  }
  if (/spec\.md/.test(text) && /(?:>|sed\s+-[a-zA-Z]*i|\btee\b|\brm\b|\bmv\b)/.test(text)) {
    reasons.push(`this command may change docs/spec.md: ${SPEC}`);
  }
  return reasons;
}

function analyze(text: string, depth = 0): string[] {
  if (depth > MAX_DEPTH) return [];
  let segments: string[][];
  try {
    segments = splitSegments(text);
  } catch {
    return fallback(text);
  }
  const reasons: string[] = [];
  for (const segment of segments) {
    reasons.push(...checkSegment(segment, depth));
    for (const word of segment) {
      for (const inner of innerCommands(word)) reasons.push(...analyze(inner, depth + 1));
    }
  }
  return reasons;
}

function main(): void {
  const input = readInput();
  const command = input.tool_input?.command;
  if (typeof command !== 'string' || command.trim() === '') return;
  let reasons: string[];
  try {
    reasons = analyze(command);
  } catch (err) {
    reasons = [`guard-bash.mts hit an internal error (${(err as Error).message}); simplify the command or fix the hook`];
  }
  reasons = [...new Set(reasons)];
  if (reasons.length === 0) return;
  block(
    [
      'Blocked by .claude/hooks/guard-bash.mts:',
      ...reasons.map((r) => `- ${r}`),
      'If this is a false positive, rephrase the command or ask Kim to run it.',
    ].join('\n'),
  );
}

main();

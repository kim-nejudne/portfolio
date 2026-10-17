// Shared helpers for the ts-dojo hooks in this folder; not a hook itself.
// A hook reads one JSON object on stdin and exits 0 (allow, or nothing to say) or 2
// (block; stderr is the reason Claude sees). Reference: https://code.claude.com/docs/en/hooks
// Runs on Node 24 with type stripping, so only erasable TypeScript syntax is used here.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, writeSync } from 'node:fs';
import path from 'node:path';

export interface HookInput {
  session_id?: string;
  cwd?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  stop_hook_active?: boolean;
  source?: string;
}

/** The JSON Claude Code pipes to every hook; an empty object when stdin is empty or malformed. */
export function readInput(): HookInput {
  try {
    const raw = readFileSync(0, 'utf8').trim();
    return raw ? (JSON.parse(raw) as HookInput) : {};
  } catch {
    return {};
  }
}

/** The repo root: CLAUDE_PROJECT_DIR (exported by Claude Code), else the hook's cwd. */
export function projectRoot(input: HookInput): string {
  return path.resolve(process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd());
}

export function realPath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

/** package.json scripts; {} when it has none; null when there is no package.json yet (Prep, early F1). */
export function readScripts(root: string): Record<string, string> | null {
  const file = path.join(root, 'package.json');
  if (!existsSync(file)) return null;
  try {
    const pkg = JSON.parse(readFileSync(file, 'utf8')) as { scripts?: Record<string, string> };
    return pkg.scripts ?? {};
  } catch {
    return {};
  }
}

export interface RunResult {
  ok: boolean;
  status: number | null;
  timedOut: boolean;
  output: string;
}

/** Run a command to completion with colour off, capturing stdout and stderr together. */
export function run(cmd: string, args: string[], opts: { cwd: string; timeoutMs: number }): RunResult {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: 'utf8',
    timeout: opts.timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', CI: '1' },
  });
  const errCode = (res.error as NodeJS.ErrnoException | undefined)?.code;
  const timedOut = res.signal === 'SIGTERM' || errCode === 'ETIMEDOUT';
  let output = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  if (res.error) output += `\n${res.error.message}`;
  if (timedOut) output += `\n(timed out after ${Math.round(opts.timeoutMs / 1000)} s)`;
  return { ok: res.status === 0 && !res.error, status: res.status, timedOut, output };
}

export function tail(text: string, lines: number): string {
  return text.trimEnd().split('\n').slice(-lines).join('\n');
}

/** Print a JSON reply on stdout (systemMessage, decision, hookSpecificOutput, ...). */
export function emit(json: Record<string, unknown>): void {
  writeSync(1, `${JSON.stringify(json)}\n`);
}

/** Block the action: the message goes to stderr (Claude sees it) and the process exits 2. */
export function block(message: string): never {
  writeSync(2, message.endsWith('\n') ? message : `${message}\n`);
  process.exit(2);
}

/* ---------- command-line analysis, shared by guard-bash and pre-commit ---------- */

const HEREDOC =
  /<<-?\s*(["']?)([A-Za-z_][A-Za-z0-9_]*)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g;

/** Drop heredoc bodies so their text (a README, a commit message) isn't read as commands. */
export function stripHeredocs(text: string): string {
  return text.replace(HEREDOC, (_m, _q: string, tag: string, rest: string) => `<<${tag}${rest}`);
}

const SEGMENT_BREAK = new Set([';', '&', '|', '\n', '(', ')', '`']);

/**
 * Split a command line into simple commands (lists of words). Quotes and backslashes are
 * honoured; `;` `&` `&&` `|` `||` newlines, sub-shells, backticks and `$(` start a new
 * segment, so substitutions are checked as commands too. Redirections (`>` `>>` `<` `>&`)
 * become words of their own. A quoted word keeps its text without the quotes; use
 * innerCommands() to look inside it for `$(...)`.
 */
export function splitSegments(command: string): string[][] {
  const text = stripHeredocs(command).replace(/\\\n/g, ' ');
  const segments: string[][] = [];
  let words: string[] = [];
  let word = '';
  let inWord = false;
  let quote: '"' | "'" | null = null;

  const endWord = (): void => {
    if (inWord) words.push(word);
    word = '';
    inWord = false;
  };
  const endSegment = (): void => {
    endWord();
    if (words.length) segments.push(words);
    words = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (quote === "'") {
      if (c === "'") quote = null;
      else word += c;
      continue;
    }
    if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === '\\' && i + 1 < text.length) word += text[++i];
      else word += c;
      continue;
    }
    if (c === '\\' && i + 1 < text.length) {
      word += text[++i];
      inWord = true;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      inWord = true;
      continue;
    }
    if (c === '$' && text[i + 1] === '(') {
      endSegment();
      i++;
      continue;
    }
    if (SEGMENT_BREAK.has(c)) {
      endSegment();
      continue;
    }
    if (c === '>' || c === '<') {
      endWord();
      let op = c;
      if (text[i + 1] === c) {
        op += c;
        i++;
      }
      if (text[i + 1] === '&') {
        op += '&';
        i++;
      }
      words.push(op);
      continue;
    }
    if (/\s/.test(c)) {
      endWord();
      continue;
    }
    word += c;
    inWord = true;
  }
  endSegment();
  return segments;
}

/** The inner text of every `$(...)` and `...` inside one word (quoted strings keep them). */
export function innerCommands(word: string): string[] {
  const found: string[] = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] === '$' && word[i + 1] === '(') {
      let depth = 1;
      let j = i + 2;
      for (; j < word.length && depth > 0; j++) {
        if (word[j] === '(') depth++;
        else if (word[j] === ')') depth--;
      }
      found.push(word.slice(i + 2, depth === 0 ? j - 1 : j));
      i = j - 1;
    } else if (word[i] === '`') {
      const end = word.indexOf('`', i + 1);
      if (end === -1) break;
      found.push(word.slice(i + 1, end));
      i = end;
    }
  }
  return found;
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const RTK_RUNNERS = new Set(['proxy', 'run', 'err', 'summary', 'test']);
const PLAIN_WRAPPERS = new Set([
  'nohup', 'time', 'builtin', 'exec', 'noglob', 'nocorrect', 'nice', 'ionice', 'stdbuf', 'setsid', 'chronic',
]);

/**
 * Drop leading assignments and wrappers (sudo, env, nohup, time, timeout, xargs, rtk, ...)
 * so that words[0] is the command that actually runs. `command -v x` is a lookup, not a
 * run, and returns [].
 */
export function unwrap(words: string[]): string[] {
  let i = 0;
  while (i < words.length) {
    const w = words[i] as string;
    const name = path.basename(w);
    if (ASSIGNMENT.test(w)) {
      i++;
    } else if (name === 'sudo' || name === 'doas') {
      i++;
      while (i < words.length && (words[i] as string).startsWith('-')) {
        i += ['-u', '-g', '-h', '-p', '-C', '-D', '-U', '-T', '-r', '-t'].includes(words[i] as string) ? 2 : 1;
      }
    } else if (name === 'command') {
      if (words[i + 1] === '-v' || words[i + 1] === '-V') return [];
      i++;
      while (i < words.length && (words[i] as string).startsWith('-')) i++;
    } else if (PLAIN_WRAPPERS.has(name)) {
      i++;
      while (i < words.length && (words[i] as string).startsWith('-')) {
        i += ['-n', '-c', '-o', '-e', '-i'].includes(words[i] as string) ? 2 : 1;
      }
    } else if (name === 'timeout' || name === 'flock') {
      i++;
      while (i < words.length && (words[i] as string).startsWith('-')) {
        i += ['-s', '-k', '-w', '-E'].includes(words[i] as string) ? 2 : 1;
      }
      i++; // the duration, or the lock file
    } else if (name === 'env') {
      let j = i + 1;
      while (j < words.length && ((words[j] as string).startsWith('-') || ASSIGNMENT.test(words[j] as string))) {
        j += ['-u', '-C', '-S'].includes(words[j] as string) ? 2 : 1;
      }
      if (j >= words.length) return words.slice(i); // a bare `env` prints the environment
      i = j;
    } else if (name === 'xargs') {
      i++;
      while (i < words.length && (words[i] as string).startsWith('-')) {
        i += ['-n', '-P', '-I', '-L', '-d', '-a', '-E', '-s'].includes(words[i] as string) ? 2 : 1;
      }
    } else if (name === 'rtk' && i + 1 < words.length) {
      i += RTK_RUNNERS.has(words[i + 1] as string) ? 2 : 1;
    } else {
      break;
    }
  }
  return words.slice(i);
}

/** `git [global options] <subcommand> <rest>` → the subcommand and what follows it. */
export function gitSubcommand(words: string[]): { sub: string | null; rest: string[] } {
  const takesValue = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--exec-path']);
  let i = 1;
  while (i < words.length) {
    const w = words[i] as string;
    if (takesValue.has(w)) i += 2;
    else if (w.startsWith('-')) i++;
    else return { sub: w, rest: words.slice(i + 1) };
  }
  return { sub: null, rest: [] };
}

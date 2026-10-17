// The vimrc (spec §4 Mappings and the vimrc): the shipped text, the parser for the supported
// lines (the `map` family, `unmap`, `set <option>`, `let mapleader = "<key>"`, `"` comments)
// and the apply step that turns them into `Vim.map`, `Vim.unmap` and option calls. Bad lines
// are reported with their number and skipped; the good lines still apply. The engine rules
// from docs/prep-vim.md: `<leader>` means nothing to the engine, so the parser expands it to
// the virtual `<Leader>` key that `leaderKey` maps the leader to; `unmap` removes only the
// newest definition, so a re-apply starts with `mapclear` and the app's own mappings.

/** §4's shipped defaults, verbatim. */
export const SHIPPED_VIMRC = `let mapleader = " "
imap jk <Esc>
nmap <leader>r :run<CR>
nmap <leader>t :test<CR>
nmap <leader>h :hint<CR>
nmap ]d :dnext<CR>
nmap [d :dprev<CR>
nmap K :info<CR>
nmap gd :def<CR>
nmap gt :bnext<CR>
nmap gT :bprev<CR>
nmap <C-h> :focus left<CR>
nmap <C-j> :focus down<CR>
nmap <C-k> :focus up<CR>
nmap <C-l> :focus right<CR>
set rnu
`;

export type VimContext = 'normal' | 'visual' | 'insert';

export type VimrcCommand = { line: number } & (
  | {
      kind: 'map';
      contexts: VimContext[];
      lhs: string;
      rhs: string;
      noremap: boolean;
    }
  | { kind: 'unmap'; contexts: VimContext[]; lhs: string }
  | { kind: 'set'; name: string; value: boolean | string }
);

export interface VimrcError {
  /** 1-based line number in the vimrc text. */
  line: number;
  /** The line as written, trimmed. */
  text: string;
  message: string;
}

export interface ParsedVimrc {
  commands: VimrcCommand[];
  errors: VimrcError[];
  /** The `mapleader` key in Vim notation (`<Space>`, `,`); Vim's default is a backslash. */
  leader: string;
}

const MAP_CONTEXTS: Record<string, VimContext[]> = {
  map: ['normal', 'visual'],
  noremap: ['normal', 'visual'],
  nmap: ['normal'],
  nnoremap: ['normal'],
  imap: ['insert'],
  inoremap: ['insert'],
  vmap: ['visual'],
  vnoremap: ['visual'],
};

const UNMAP_CONTEXTS: Record<string, VimContext[]> = {
  unmap: ['normal', 'visual'],
  nunmap: ['normal'],
  iunmap: ['insert'],
  vunmap: ['visual'],
};

const LEADER = /<leader>/gi;

/** `<leader>x` → `<Leader>x`, the prefix key `leaderKey` maps the real leader to. */
export function expandLeader(keys: string): string {
  return keys.replace(LEADER, '<Leader>');
}

/** `" "` → `<Space>`; any other quoted text is taken as Vim key notation. */
function leaderFromQuoted(quoted: string): string | null {
  const match = /^(["'])(.*)\1$/.exec(quoted);
  if (match === null) return null;
  const value = match[2] ?? '';
  if (value === '') return null;
  return value === ' ' ? '<Space>' : value;
}

export function parseVimrc(text: string): ParsedVimrc {
  const commands: VimrcCommand[] = [];
  const errors: VimrcError[] = [];
  let leader = '\\';
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('"')) return;
    const fail = (message: string): void => {
      errors.push({ line, text: trimmed, message });
    };
    const space = trimmed.search(/\s/);
    const command = space === -1 ? trimmed : trimmed.slice(0, space);
    const args = space === -1 ? '' : trimmed.slice(space).trim();

    const mapContexts = MAP_CONTEXTS[command];
    if (mapContexts !== undefined) {
      const gap = args.search(/\s/);
      if (args === '' || gap === -1) {
        fail(`${command} needs a key and what it maps to`);
        return;
      }
      commands.push({
        line,
        kind: 'map',
        contexts: [...mapContexts],
        lhs: expandLeader(args.slice(0, gap)),
        rhs: expandLeader(args.slice(gap).trim()),
        noremap: command.includes('noremap'),
      });
      return;
    }

    const unmapContexts = UNMAP_CONTEXTS[command];
    if (unmapContexts !== undefined) {
      if (args === '' || /\s/.test(args)) {
        fail(`${command} needs exactly one key`);
        return;
      }
      commands.push({
        line,
        kind: 'unmap',
        contexts: [...unmapContexts],
        lhs: expandLeader(args),
      });
      return;
    }

    if (command === 'set') {
      if (args === '' || /\s/.test(args)) {
        fail('set needs exactly one option');
        return;
      }
      const assignment = /^([a-z]+)=(.+)$/.exec(args);
      if (assignment !== null) {
        commands.push({
          line,
          kind: 'set',
          name: assignment[1] ?? '',
          value: assignment[2] ?? '',
        });
        return;
      }
      if (!/^[a-z]+$/.test(args)) {
        fail(`set does not understand "${args}"`);
        return;
      }
      if (args.startsWith('no') && args.length > 2) {
        commands.push({ line, kind: 'set', name: args.slice(2), value: false });
      } else {
        commands.push({ line, kind: 'set', name: args, value: true });
      }
      return;
    }

    if (command === 'let') {
      const match = /^mapleader\s*=\s*(.+)$/.exec(args);
      const key = match === null ? null : leaderFromQuoted(match[1] ?? '');
      if (key === null) {
        fail('let supports only mapleader = "<key>"');
        return;
      }
      leader = key;
      return;
    }

    fail(`unknown command "${command}"`);
  });
  return { commands, errors, leader };
}

/** The slice of `Vim` the apply step uses; the engine's own object fits it. */
export interface VimApi {
  map(lhs: string, rhs: string, ctx: string): void;
  noremap(lhs: string, rhs: string, ctx: string): void;
  unmap(lhs: string, ctx: string): unknown;
  mapclear(ctx?: string): void;
  setOption(name: string, value: unknown): Error | undefined;
}

export const VIM_CONTEXTS: readonly VimContext[] = [
  'normal',
  'visual',
  'insert',
];

/**
 * Applies a parsed vimrc: clears the user layer in every context, re-applies the app's own
 * mappings through `defaults` (they must come back after the clear), then the lines in order.
 * Returns the parse errors plus the lines the engine refused, by line number.
 */
export function applyVimrc(
  parsed: ParsedVimrc,
  vim: VimApi,
  defaults: (leader: string) => void,
): VimrcError[] {
  for (const ctx of VIM_CONTEXTS) vim.mapclear(ctx);
  defaults(parsed.leader);
  const errors = [...parsed.errors];
  for (const command of parsed.commands) {
    switch (command.kind) {
      case 'map':
        for (const ctx of command.contexts) {
          if (command.noremap) vim.noremap(command.lhs, command.rhs, ctx);
          else vim.map(command.lhs, command.rhs, ctx);
        }
        break;
      case 'unmap': {
        let removed = false;
        for (const ctx of command.contexts) {
          if (vim.unmap(command.lhs, ctx)) removed = true;
        }
        if (!removed) {
          errors.push({
            line: command.line,
            text: describe(command),
            message: `no such mapping: ${command.lhs}`,
          });
        }
        break;
      }
      case 'set': {
        const error = vim.setOption(command.name, command.value);
        if (error !== undefined) {
          errors.push({
            line: command.line,
            text: describe(command),
            message: error.message,
          });
        }
        break;
      }
    }
  }
  return errors.sort((a, b) => a.line - b.line);
}

function describe(command: VimrcCommand): string {
  switch (command.kind) {
    case 'map':
      return `map ${command.lhs} ${command.rhs}`;
    case 'unmap':
      return `unmap ${command.lhs}`;
    case 'set':
      return typeof command.value === 'string'
        ? `set ${command.name}=${command.value}`
        : `set ${command.value ? '' : 'no'}${command.name}`;
  }
}

/** "vimrc line 3: unknown command "foo"", the form the editor's status line shows. */
export function formatVimrcError(error: VimrcError): string {
  return `vimrc line ${String(error.line)}: ${error.message}`;
}

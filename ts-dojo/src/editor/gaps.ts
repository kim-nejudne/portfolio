// "What Vim mode can't do": the gaps the Prep spike recorded in docs/prep-vim.md, shown in the
// `?` help overlay (spec §6). F3 owns the editor; a line leaves this list only when its gap closes.
export const VIM_GAPS: readonly string[] = [
  'it and at do nothing in a TypeScript buffer (no HTML or XML tags in the syntax tree).',
  'Insert-mode Ctrl-w: Chrome keeps the key; use Ctrl-Backspace.',
  'U is a plain undo, not "undo all changes on the last changed line".',
  'A custom mapping cannot start with a key that is a command on its own (Space, comma, s, ...); use <leader>.',
  '? from inside a match skips that match; a" a\' a` do not take the surrounding space.',
  'Visual block: I, A, $A, c and d are known to work; other insert edge cases are untested.',
  'No zf, zd, zj, zk; no g; g, gx gf. gq and :normal work but are not promised.',
];

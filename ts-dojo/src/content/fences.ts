// What the browser and the Node fence pipeline share about code fences (spec §3 lesson.mdx):
// the four `ts` fence kinds and `plain` (every fence in another language, after F13), the
// meta-string parser, the props a rendered `<CodeBlock>` receives and the virtual path a theory
// snippet is checked and emitted under. No Node imports here; src/content/node/mdx.ts renders,
// src/content/components/code-block.tsx displays.
import type { Diag, EmittedImport } from '@/protocol/ts-ls';

export type FenceKind =
  'static' | 'run' | 'run-errors' | 'twoslash' | 'plain' | 'other';

/** The component every fence renders as (src/content/components/code-block.tsx). */
export const CODE_BLOCK_COMPONENT = 'CodeBlock';
/**
 * The element that carries a lesson's colour classes (`.sk-…{--shiki-light:…;--shiki-dark:…}`),
 * once per lesson: shiki's inline styles became classes for the §9 precache (pre-F13 fixes).
 */
export const CODE_STYLES_COMPONENT = 'CodeStyles';
/** The virtual path a theory snippet is checked and emitted under. */
export const SNIPPET_PATH = '/snippet.ts';

/**
 * The props `<CodeBlock>` receives; `diagnostics` and `imports` travel as JSON strings in the
 * MDX. `imports` are the spans of the emitted JavaScript's import specifiers (F14: a `zod`
 * import must reach the sandbox's resolver), present only when the snippet imports something.
 */
export interface CodeBlockProps {
  kind: Exclude<FenceKind, 'other'>;
  code: string;
  html: string;
  js?: string;
  diagnostics?: Diag[];
  imports?: EmittedImport[];
}

/**
 * The fence kinds of §3 lesson.mdx; `ts` with any other meta string is `other`. A fence in another
 * language, or none, is `plain` (Kim's decision after F13): the code-block look and nothing to run.
 */
export function fenceKind(lang: string | null, meta: string | null): FenceKind {
  if (lang !== 'ts') return 'plain';
  const words = (meta ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'static';
  if (words.length === 1 && words[0] === 'run') return 'run';
  if (words.length === 2 && words[0] === 'run' && words[1] === 'errors') {
    return 'run-errors';
  }
  if (words.length === 1 && words[0] === 'twoslash') return 'twoslash';
  return 'other';
}

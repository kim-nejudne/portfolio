// What the browser and the Node fence pipeline share about code fences (spec §3 lesson.mdx):
// the four fence kinds, the meta-string parser, the props a rendered `<CodeBlock>` receives
// and the virtual path a theory snippet is checked and emitted under. No Node imports here;
// src/content/node/mdx.ts renders, src/content/components/code-block.tsx displays.
import type { Diag } from '@/protocol/ts-ls';

export type FenceKind = 'static' | 'run' | 'run-errors' | 'twoslash' | 'other';

/** The component every `ts` fence renders as (src/content/components/code-block.tsx). */
export const CODE_BLOCK_COMPONENT = 'CodeBlock';
/** The virtual path a theory snippet is checked and emitted under. */
export const SNIPPET_PATH = '/snippet.ts';

/** The props `<CodeBlock>` receives; `js` and `diagnostics` travel as JSON strings in the MDX. */
export interface CodeBlockProps {
  kind: Exclude<FenceKind, 'other'>;
  code: string;
  html: string;
  js?: string;
  diagnostics?: Diag[];
}

/** The fence kinds of §3 lesson.mdx; `ts` with anything else is `other`. */
export function fenceKind(lang: string | null, meta: string | null): FenceKind {
  if (lang !== 'ts') return 'other';
  const words = (meta ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'static';
  if (words.length === 1 && words[0] === 'run') return 'run';
  if (words.length === 2 && words[0] === 'run' && words[1] === 'errors') {
    return 'run-errors';
  }
  if (words.length === 1 && words[0] === 'twoslash') return 'twoslash';
  return 'other';
}

// The lesson.mdx code-fence pipeline (spec §3 lesson.mdx, §2 Build "twoslash pre-render
// through the shiki transformer"): every `ts` fence becomes a `<CodeBlock>` element at build
// time, with shiki's highlighting as HTML (light and dark themes side by side, so no theme
// code runs in the browser), and per kind: `ts twoslash` renders its `^?` queries through
// `twoslash` 0.3.9 and `@shikijs/twoslash` with the §2 default compiler options and the same
// lib files and ambient runtime declarations the app's worker uses, so the types shown are
// the types the editor would show; `ts run` and `ts run errors` carry the snippet's emitted
// JavaScript so Run needs no compiler round trip, and `run errors` carries the diagnostics the
// app's own ts-ls core reports, rendered under the block. Nothing here reaches the browser:
// the Vite plugin (src/content/vite-plugin.ts) and the content lint share this file.
import { transformerTwoslash } from '@shikijs/twoslash';
import { rendererClassic } from '@shikijs/twoslash/core';
import type { Code, Root } from 'mdast';
import type { MdxJsxAttribute, MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import remarkFrontmatter from 'remark-frontmatter';
import { createHighlighter, type Highlighter } from 'shiki';
import { createTwoslasher, type TwoslashInstance } from 'twoslash';
import ts from 'typescript';
import { visit } from 'unist-util-visit';
import { DEFAULT_COMPILER_OPTIONS, type Diag } from '@/protocol/ts-ls';
import { AMBIENT_RUNTIME_DTS } from '@/workers/ts-ls/ambient';
import { createTsLsCore, type TsLsCore } from '@/workers/ts-ls/core';
import { loadLibs } from '@/workers/ts-ls/libs';
import { nodeFetchLib } from '@/workers/ts-ls/node/fetch-lib';
import {
  CODE_BLOCK_COMPONENT,
  fenceKind,
  SNIPPET_PATH,
  type CodeBlockProps,
} from '../fences';

export const SHIKI_THEMES = {
  light: 'github-light',
  dark: 'github-dark',
} as const;

export type { CodeBlockProps };
export { CODE_BLOCK_COMPONENT, SNIPPET_PATH };

export class FenceRenderError extends Error {
  override readonly name = 'FenceRenderError';
  readonly path: string;
  readonly line: number;
  constructor(path: string, line: number, message: string) {
    super(`${path}:${String(line)}: ${message}`);
    this.path = path;
    this.line = line;
  }
}

export interface Renderer {
  /** Renders one fence; throws `FenceRenderError` for a twoslash block that does not render. */
  render(
    kind: CodeBlockProps['kind'],
    code: string,
    at: { path: string; line: number },
  ): Promise<CodeBlockProps>;
  /** The diagnostics of a snippet under the §2 defaults (the lint's §3 condition 6). */
  check(code: string): Promise<Diag[]>;
  dispose(): void;
}

function convertedDefaults(): ts.CompilerOptions {
  const { options, errors } = ts.convertCompilerOptionsFromJson(
    DEFAULT_COMPILER_OPTIONS,
    '/',
  );
  if (errors.length > 0) {
    throw new Error(
      `default compiler options: ${errors
        .map((e) => ts.flattenDiagnosticMessageText(e.messageText, ' '))
        .join('; ')}`,
    );
  }
  return options;
}

/** The twoslasher over the app's lib files and ambient runtime declarations. */
async function createDojoTwoslasher(): Promise<TwoslashInstance> {
  const compilerOptions = convertedDefaults();
  const fsMap = new Map<string, string>();
  await loadLibs(compilerOptions.lib ?? [], fsMap, nodeFetchLib);
  return createTwoslasher({
    tsModule: ts,
    compilerOptions,
    fsMap,
    extraFiles: { 'dojo-runtime.d.ts': AMBIENT_RUNTIME_DTS },
  });
}

export async function createRenderer(): Promise<Renderer> {
  const [highlighter, twoslasher]: [Highlighter, TwoslashInstance] =
    await Promise.all([
      createHighlighter({
        themes: [SHIKI_THEMES.light, SHIKI_THEMES.dark],
        langs: ['ts'],
      }),
      createDojoTwoslasher(),
    ]);
  const core: TsLsCore = createTsLsCore({ fetchLib: nodeFetchLib });
  let coreReady: Promise<unknown> | null = null;
  // One project at a time: the build compiles lessons concurrently through this one renderer,
  // and the core holds a single open project, so each snippet's open, check and emit run as
  // one step in a queue.
  let queue: Promise<unknown> = Promise.resolve();
  const withSnippet = <T>(code: string, work: () => T): Promise<T> => {
    const step = queue.then(async () => {
      coreReady ??= core.init();
      await coreReady;
      await core.openProject({ files: [{ path: SNIPPET_PATH, text: code }] });
      return work();
    });
    queue = step.catch(() => undefined);
    return step;
  };
  const highlight = (code: string, twoslash: boolean): string =>
    highlighter.codeToHtml(code, {
      lang: 'ts',
      themes: SHIKI_THEMES,
      defaultColor: false,
      transformers: twoslash
        ? [
            transformerTwoslash({
              twoslasher,
              explicitTrigger: false,
              renderer: rendererClassic(),
              throws: true,
            }),
          ]
        : [],
    });

  return {
    async render(kind, code, at) {
      if (kind === 'twoslash') {
        try {
          return { kind, code, html: highlight(code, true) };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          throw new FenceRenderError(
            at.path,
            at.line,
            `ts twoslash block failed to render: ${message}`,
          );
        }
      }
      const html = highlight(code, false);
      if (kind === 'static') return { kind, code, html };
      const { js, diagnostics } = await withSnippet(code, () => ({
        js: core.emit([SNIPPET_PATH]).files[0]?.js ?? '',
        diagnostics: core.getDiagnostics([SNIPPET_PATH]).diagnostics,
      }));
      return kind === 'run'
        ? { kind, code, html, js }
        : { kind, code, html, js, diagnostics };
    },
    check(code) {
      return withSnippet(
        code,
        () => core.getDiagnostics([SNIPPET_PATH]).diagnostics,
      );
    },
    dispose() {
      highlighter.dispose();
      core.dispose();
    },
  };
}

function attribute(name: string, value: string): MdxJsxAttribute {
  return { type: 'mdxJsxAttribute', name, value };
}

/** The `<CodeBlock … />` element for one rendered fence. */
export function codeBlockElement(props: CodeBlockProps): MdxJsxFlowElement {
  const attributes = [
    attribute('kind', props.kind),
    attribute('code', props.code),
    attribute('html', props.html),
  ];
  if (props.js !== undefined) attributes.push(attribute('js', props.js));
  if (props.diagnostics !== undefined) {
    attributes.push(
      attribute('diagnostics', JSON.stringify(props.diagnostics)),
    );
  }
  return {
    type: 'mdxJsxFlowElement',
    name: CODE_BLOCK_COMPONENT,
    attributes,
    children: [],
  };
}

/**
 * The remark plugin: every `ts` fence of a known kind is replaced by its `<CodeBlock>`; other
 * fences are left to MDX's default `<pre><code>`.
 */
export function remarkDojoCode(getRenderer: () => Promise<Renderer>) {
  return () =>
    async (tree: Root, file: { path?: string | undefined }): Promise<void> => {
      const path = file.path ?? 'lesson.mdx';
      const fences: {
        node: Code;
        index: number;
        parent: { children: unknown[] };
      }[] = [];
      visit(tree, 'code', (node, index, parent) => {
        if (index === undefined || parent === undefined) return;
        if (fenceKind(node.lang ?? null, node.meta ?? null) === 'other') return;
        fences.push({ node, index, parent });
      });
      if (fences.length === 0) return;
      const renderer = await getRenderer();
      for (const { node, index, parent } of fences) {
        const kind = fenceKind(node.lang ?? null, node.meta ?? null);
        if (kind === 'other') continue;
        const props = await renderer.render(kind, node.value, {
          path,
          line: node.position?.start.line ?? 0,
        });
        parent.children[index] = codeBlockElement(props);
      }
    };
}

/** The MDX compile options the Vite build and the lint share. */
export function lessonMdxOptions(getRenderer: () => Promise<Renderer>) {
  return {
    remarkPlugins: [remarkFrontmatter, remarkDojoCode(getRenderer)],
  };
}

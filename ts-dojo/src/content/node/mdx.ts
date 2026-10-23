// The lesson.mdx code-fence pipeline (spec §3 lesson.mdx, §2 Build "twoslash pre-render
// through the shiki transformer"): every fence becomes a `<CodeBlock>` element at build
// time, with shiki's highlighting as HTML (light and dark themes side by side, so no theme
// code runs in the browser), and per kind: `ts twoslash` renders its `^?` queries through
// `twoslash` 0.3.9 and `@shikijs/twoslash` with the §2 default compiler options and the same
// lib files and ambient runtime declarations the app's worker uses, so the types shown are
// the types the editor would show; `ts run` and `ts run errors` carry the snippet's emitted
// JavaScript so Run needs no compiler round trip, and `run errors` carries the diagnostics the
// app's own ts-ls core reports, rendered under the block. A fence in another language is
// `plain` (after F13, Kim's decision on 23 October 2026): highlighted in that language when
// shiki bundles it, else as text, and nothing more. Shiki's inline colour styles become
// classes named from the colour pair, and each lesson gets one `<CodeStyles>` element with
// their declarations (pre-F13 fixes, Kim's decision on 23 October 2026: about 40% of a lesson
// chunk was those styles, against the §9 precache budget). Nothing here reaches the browser:
// the Vite plugin (src/content/vite-plugin.ts) and the content lint share this file.
import { transformerTwoslash } from '@shikijs/twoslash';
import { rendererClassic } from '@shikijs/twoslash/core';
import type { Code, Root } from 'mdast';
import type { MdxJsxAttribute, MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import remarkFrontmatter from 'remark-frontmatter';
import {
  bundledLanguages,
  createHighlighter,
  type BundledLanguage,
  type Highlighter,
  type ShikiTransformer,
} from 'shiki';
import { createTwoslasher, type TwoslashInstance } from 'twoslash';
import ts from 'typescript';
import { visit } from 'unist-util-visit';
import { DEFAULT_COMPILER_OPTIONS, type Diag } from '@/protocol/ts-ls';
import { AMBIENT_RUNTIME_DTS } from '@/workers/ts-ls/ambient';
import {
  collectPackageTypes,
  nodeLoadPackageTypes,
} from '@/workers/ts-ls/node/package-types';

/** Packages theory may import in a `ts twoslash` block only (build time, never shipped). */
const TWOSLASH_EXTRA_PACKAGES = ['valibot'];

/** Libs a `ts twoslash` block may add with `// @lib:`, beyond the §2 default. */
const TWOSLASH_EXTRA_LIBS = [
  'lib.dom.d.ts',
  'lib.dom.iterable.d.ts',
  'lib.dom.asynciterable.d.ts',
];
import { createTsLsCore, type TsLsCore } from '@/workers/ts-ls/core';
import { loadLibs } from '@/workers/ts-ls/libs';
import { nodeFetchLib } from '@/workers/ts-ls/node/fetch-lib';
import {
  CODE_BLOCK_COMPONENT,
  CODE_STYLES_COMPONENT,
  fenceKind,
  SNIPPET_PATH,
  type CodeBlockProps,
} from '../fences';

export const SHIKI_THEMES = {
  light: 'github-light',
  dark: 'github-dark',
} as const;

export type { CodeBlockProps };
export { CODE_BLOCK_COMPONENT, CODE_STYLES_COMPONENT, SNIPPET_PATH };

/** A rendered fence: the `<CodeBlock>` props, and its colour classes with their declarations. */
export interface RenderedFence extends CodeBlockProps {
  styles: Record<string, string>;
}

/** A style shiki writes with `defaultColor: false`: its theme variables and nothing else. */
const SHIKI_VARIABLES = /^(?:--shiki-[a-z-]+:[^;]+;?)+$/;

/** `sk-` and a base-36 FNV-1a hash of the declarations: one pair, one class, in every build. */
export function styleClass(style: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < style.length; i++) {
    hash ^= style.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `sk-${(hash >>> 0).toString(36)}`;
}

type HastRoot = Parameters<NonNullable<ShikiTransformer['root']>>[0];
type HastNode = HastRoot | HastRoot['children'][number];

/**
 * The last transformer: every element whose style is only shiki's variables gets a class
 * instead, recorded in `styles`. The app's CSS reads the same variables either way.
 */
function transformerStyleClasses(
  styles: Map<string, string>,
): ShikiTransformer {
  const walk = (node: HastNode): void => {
    if (node.type === 'element') {
      const { style } = node.properties;
      if (typeof style === 'string' && SHIKI_VARIABLES.test(style)) {
        const name = styleClass(style);
        styles.set(name, style);
        delete node.properties['style'];
        const existing = node.properties['class'];
        node.properties['class'] = Array.isArray(existing)
          ? [...existing.map(String), name]
          : typeof existing === 'string'
            ? `${existing} ${name}`
            : name;
      }
    }
    if ('children' in node) for (const child of node.children) walk(child);
  };
  return {
    name: 'dojo:style-classes',
    root(root) {
      walk(root);
    },
  };
}

/** The `.sk-…{…}` rules for a lesson's colour classes, in class order. */
export function codeStylesCss(styles: ReadonlyMap<string, string>): string {
  return [...styles]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, style]) => `.${name}{${style}}`)
    .join('');
}

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
  /**
   * Renders one fence; throws `FenceRenderError` for a twoslash block that does not render.
   * `lang` is a `plain` fence's language.
   */
  render(
    kind: CodeBlockProps['kind'],
    code: string,
    at: { path: string; line: number },
    lang?: string,
  ): Promise<RenderedFence>;
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

/**
 * The twoslasher over the app's lib files, ambient runtime declarations and the pre-bundled
 * packages (§12 F14), plus valibot's types, which only theory compares with Zod (17.2) and
 * which never ship to the browser.
 */
async function createDojoTwoslasher(): Promise<TwoslashInstance> {
  const compilerOptions = convertedDefaults();
  const fsMap = new Map<string, string>();
  await loadLibs(compilerOptions.lib ?? [], fsMap, nodeFetchLib);
  // A block may add the DOM lib with `// @lib: es2025,dom` (17.3's fetch and Response), as an
  // exercise adds `libs: [dom]`; the default stays es2025 only.
  await loadLibs(TWOSLASH_EXTRA_LIBS, fsMap, nodeFetchLib);
  for (const file of collectPackageTypes(TWOSLASH_EXTRA_PACKAGES)) {
    fsMap.set(file.path, file.text);
  }
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
  const core: TsLsCore = createTsLsCore({
    fetchLib: nodeFetchLib,
    loadPackageTypes: nodeLoadPackageTypes,
  });
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
  const highlight = (
    code: string,
    twoslash: boolean,
    lang: string = 'ts',
  ): { html: string; styles: Record<string, string> } => {
    const styles = new Map<string, string>();
    const html = highlighter.codeToHtml(code, {
      lang,
      themes: SHIKI_THEMES,
      defaultColor: false,
      transformers: [
        ...(twoslash
          ? [
              transformerTwoslash({
                twoslasher,
                explicitTrigger: false,
                renderer: rendererClassic(),
                throws: true,
              }),
            ]
          : []),
        transformerStyleClasses(styles),
      ],
    });
    return { html, styles: Object.fromEntries(styles) };
  };

  /** A plain fence's grammar: its own when shiki bundles one (loaded once), else plain text. */
  const plainLang = async (lang: string | undefined): Promise<string> => {
    if (lang === undefined || !Object.hasOwn(bundledLanguages, lang)) {
      return 'text';
    }
    await highlighter.loadLanguage(lang as BundledLanguage);
    return lang;
  };

  return {
    async render(kind, code, at, lang) {
      if (kind === 'plain') {
        return { kind, code, ...highlight(code, false, await plainLang(lang)) };
      }
      if (kind === 'twoslash') {
        try {
          return { kind, code, ...highlight(code, true) };
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
      const { html, styles } = highlight(code, false);
      if (kind === 'static') return { kind, code, html, styles };
      const { js, imports, diagnostics } = await withSnippet(code, () => {
        const file = core.emit([SNIPPET_PATH]).files[0];
        return {
          js: file?.js ?? '',
          imports: file?.imports ?? [],
          diagnostics: core.getDiagnostics([SNIPPET_PATH]).diagnostics,
        };
      });
      const block =
        kind === 'run'
          ? { kind, code, html, js, styles }
          : { kind, code, html, js, diagnostics, styles };
      return imports.length > 0 ? { ...block, imports } : block;
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
  if (props.imports !== undefined) {
    attributes.push(attribute('imports', JSON.stringify(props.imports)));
  }
  return {
    type: 'mdxJsxFlowElement',
    name: CODE_BLOCK_COMPONENT,
    attributes,
    children: [],
  };
}

/** The lesson's one `<CodeStyles css="…" />`, with the rules for every colour class it uses. */
export function codeStylesElement(
  styles: ReadonlyMap<string, string>,
): MdxJsxFlowElement {
  return {
    type: 'mdxJsxFlowElement',
    name: CODE_STYLES_COMPONENT,
    attributes: [attribute('css', codeStylesCss(styles))],
    children: [],
  };
}

/**
 * The remark plugin: every fence of a known kind (any `ts` fence with a §3 meta string, and every
 * fence in another language) is replaced by its `<CodeBlock>`, and a lesson with any gets one
 * `<CodeStyles>` at the end; a `ts` fence with another meta string is left to MDX's `<pre>`.
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
      const styles = new Map<string, string>();
      for (const { node, index, parent } of fences) {
        const kind = fenceKind(node.lang ?? null, node.meta ?? null);
        if (kind === 'other') continue;
        const props = await renderer.render(
          kind,
          node.value,
          { path, line: node.position?.start.line ?? 0 },
          node.lang ?? undefined,
        );
        for (const [name, style] of Object.entries(props.styles)) {
          styles.set(name, style);
        }
        parent.children[index] = codeBlockElement(props);
      }
      tree.children.push(codeStylesElement(styles));
    };
}

/** The MDX compile options the Vite build and the lint share. */
export function lessonMdxOptions(getRenderer: () => Promise<Renderer>) {
  return {
    remarkPlugins: [remarkFrontmatter, remarkDojoCode(getRenderer)],
  };
}

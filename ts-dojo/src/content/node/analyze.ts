// Reads what a lesson.mdx declares without rendering it (spec §3 lesson.mdx): the frontmatter,
// every code fence with its meta string, and the props of every inline `<Predict>`. The build
// (the `?meta` module in src/content/vite-plugin.ts) and the content lint both start here, so
// the frontmatter the roadmap shows and the fences the lint checks come from one parse. Node
// only: it runs the MDX compiler. Prop values must be literals (`options={['a', 'b']}`,
// `answer={1}`); anything else is reported, because a question the lint cannot read cannot be
// proven to have one correct option (§3 condition 5).
import { compile } from '@mdx-js/mdx';
import type { Expression, Program } from 'estree';
import type { Root } from 'mdast';
import type { MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx';
import remarkFrontmatter from 'remark-frontmatter';
import { visit } from 'unist-util-visit';
import { parse as parseYaml } from 'yaml';
import { fenceKind, type FenceKind } from '../fences';

export type { FenceKind };

export interface Fence {
  lang: string | null;
  meta: string | null;
  kind: FenceKind;
  code: string;
  /** 1-based line of the opening fence. */
  line: number;
}

export interface PredictSite {
  /** The props as written, literal values only; validated by build-registry. */
  props: Record<string, unknown>;
  line: number;
}

export interface LessonAnalysis {
  frontmatter: unknown;
  fences: Fence[];
  predicts: PredictSite[];
}

export class LessonAnalysisError extends Error {
  override readonly name = 'LessonAnalysisError';
}

/** Evaluates a literal estree expression: strings, numbers, booleans, null, arrays and plain objects of those. */
export function literalValue(expression: Expression): unknown {
  switch (expression.type) {
    case 'Literal':
      if ('regex' in expression || 'bigint' in expression) break;
      return expression.value;
    case 'TemplateLiteral':
      if (expression.expressions.length === 0) {
        return expression.quasis.map((q) => q.value.cooked ?? '').join('');
      }
      break;
    case 'UnaryExpression':
      if (
        expression.operator === '-' &&
        expression.argument.type === 'Literal'
      ) {
        const inner = literalValue(expression.argument);
        if (typeof inner === 'number') return -inner;
      }
      break;
    case 'ArrayExpression':
      return expression.elements.map((element) => {
        if (element === null || element.type === 'SpreadElement') {
          throw new LessonAnalysisError(
            'array holes and spreads are not literal',
          );
        }
        return literalValue(element);
      });
    case 'ObjectExpression': {
      const out: Record<string, unknown> = {};
      for (const property of expression.properties) {
        if (property.type !== 'Property' || property.computed) {
          throw new LessonAnalysisError(
            'object spreads and computed keys are not literal',
          );
        }
        const key =
          property.key.type === 'Identifier'
            ? property.key.name
            : property.key.type === 'Literal'
              ? String(property.key.value)
              : null;
        if (key === null)
          throw new LessonAnalysisError('object keys must be names or strings');
        out[key] = literalValue(property.value as Expression);
      }
      return out;
    }
    default:
      break;
  }
  throw new LessonAnalysisError(`${expression.type} is not a literal`);
}

function expressionOf(program: Program | null | undefined): Expression {
  const statement = program?.body[0];
  if (
    program === undefined ||
    program === null ||
    program.body.length !== 1 ||
    statement === undefined ||
    statement.type !== 'ExpressionStatement'
  ) {
    throw new LessonAnalysisError('a prop must be one expression');
  }
  return statement.expression;
}

function propsOf(
  element: MdxJsxFlowElement | MdxJsxTextElement,
  path: string,
  line: number,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const attribute of element.attributes) {
    if (attribute.type !== 'mdxJsxAttribute') {
      throw new LessonAnalysisError(
        `${path}:${String(line)}: <Predict> props must be written out, not spread`,
      );
    }
    const value = attribute.value;
    if (value === null || value === undefined) {
      props[attribute.name] = true;
    } else if (typeof value === 'string') {
      props[attribute.name] = value;
    } else {
      try {
        props[attribute.name] = literalValue(expressionOf(value.data?.estree));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new LessonAnalysisError(
          `${path}:${String(line)}: <Predict ${attribute.name}={…}>: ${reason}`,
        );
      }
    }
  }
  return props;
}

function collector(path: string, out: LessonAnalysis) {
  return (tree: Root): void => {
    visit(tree, (node) => {
      if (node.type === 'yaml') {
        out.frontmatter = parseYaml(node.value) as unknown;
        return;
      }
      if (node.type === 'code') {
        const code = node;
        const lang = code.lang ?? null;
        const meta = code.meta ?? null;
        out.fences.push({
          lang,
          meta,
          kind: fenceKind(lang, meta),
          code: code.value,
          line: code.position?.start.line ?? 0,
        });
        return;
      }
      if (
        node.type === 'mdxJsxFlowElement' ||
        node.type === 'mdxJsxTextElement'
      ) {
        const element = node;
        if (element.name !== 'Predict') return;
        const line = element.position?.start.line ?? 0;
        out.predicts.push({ props: propsOf(element, path, line), line });
      }
    });
  };
}

/**
 * Parses one lesson.mdx. Throws `LessonAnalysisError` for MDX that does not parse, a missing
 * frontmatter block, or a `<Predict>` prop that is not a literal; the message carries the path.
 */
export async function analyzeLesson(
  source: string,
  path: string,
): Promise<LessonAnalysis> {
  const out: LessonAnalysis = {
    frontmatter: undefined,
    fences: [],
    predicts: [],
  };
  try {
    await compile(
      { value: source, path },
      {
        remarkPlugins: [remarkFrontmatter, () => collector(path, out)],
      },
    );
  } catch (error) {
    if (error instanceof LessonAnalysisError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new LessonAnalysisError(`${path}: ${reason}`);
  }
  if (out.frontmatter === undefined) {
    throw new LessonAnalysisError(`${path}: no frontmatter block`);
  }
  return out;
}

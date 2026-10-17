// §5 Type cases: finding the cases in tests.ts by walking its AST. A case is every element of
// a top-level tuple type alias whose name starts with `cases`, and every top-level statement
// whose leading comment is `@ts-expect-error`. Its name is a trailing `// name` comment, or
// `case N` counted in source order; its range is the element's or statement's text range,
// extended back to a leading `@ts-expect-error` line so an unused directive's TS2578 falls
// inside it. The grouping of diagnostics into these ranges is src/verify/cases.ts.
import ts from 'typescript';
import type { CaseRange } from '@/verify/cases';

export const CASES_PREFIX = 'cases';

const EXPECT_ERROR_SINGLE_LINE = /^\/\/\/?\s*@ts-expect-error\b/;
const EXPECT_ERROR_MULTI_LINE = /^(?:\/|\*)*\s*@ts-expect-error\b/;

export function isExpectErrorDirective(comment: string): boolean {
  return comment.startsWith('//')
    ? EXPECT_ERROR_SINGLE_LINE.test(comment)
    : EXPECT_ERROR_MULTI_LINE.test(comment);
}

export function findCases(sourceFile: ts.SourceFile): CaseRange[] {
  const { text } = sourceFile;
  const cases: CaseRange[] = [];

  /** The start of the last `@ts-expect-error` comment leading the node, if any. */
  const directiveStart = (node: ts.Node): number | null => {
    const ranges = ts.getLeadingCommentRanges(text, node.getFullStart());
    if (ranges === undefined) return null;
    for (let i = ranges.length - 1; i >= 0; i--) {
      const range = ranges[i] as ts.CommentRange;
      if (isExpectErrorDirective(text.slice(range.pos, range.end))) {
        return range.pos;
      }
    }
    return null;
  };

  /** `// name` on the node's last line, after an optional comma. */
  const trailingName = (end: number): string | null => {
    let pos = end;
    while (text[pos] === ' ' || text[pos] === '\t') pos++;
    if (text[pos] === ',') pos++;
    const first = ts.getTrailingCommentRanges(text, pos)?.[0];
    if (
      first === undefined ||
      first.kind !== ts.SyntaxKind.SingleLineCommentTrivia
    ) {
      return null;
    }
    const name = text.slice(first.pos + 2, first.end).trim();
    return name.length > 0 ? name : null;
  };

  const add = (node: ts.Node, directive: number | null): void => {
    const ordinal = cases.length + 1;
    cases.push({
      name: trailingName(node.getEnd()) ?? `case ${ordinal}`,
      start: directive ?? node.getStart(sourceFile),
      end: node.getEnd(),
    });
  };

  for (const statement of sourceFile.statements) {
    if (
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text.startsWith(CASES_PREFIX) &&
      ts.isTupleTypeNode(statement.type)
    ) {
      for (const element of statement.type.elements) {
        add(element, directiveStart(element));
      }
      continue;
    }
    const directive = directiveStart(statement);
    if (directive !== null) add(statement, directive);
  }
  return cases;
}

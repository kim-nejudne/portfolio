// The §5 AST rules, run by the ts-ls core's `lintAst`: one `ts.forEachChild` walk per user
// file plus a comment walk for `ts-directive`. Every hit carries the rule, the file, the line
// and the column. The ids, messages and the always-on set are src/verify/rules.ts.
import ts from 'typescript';
import type { Diag, RuleHit } from '@/protocol/ts-ls';
import { RULE_MESSAGES, type RuleId } from '@/verify/rules';

export interface LintContext {
  /** tests.ts: `ts-directive` is skipped and `no-skipped-tests` applies. */
  isTestFile: boolean;
  /** The file's diagnostics with the §5 `implicit-any` codes (7006, 7031). */
  implicitAny: readonly Diag[];
}

// The compiler's own forms (parser.ts commentDirectiveRegExSingleLine / MultiLine), with
// @ts-nocheck added: only these silence errors, so only these fail the rule.
const SINGLE_LINE_DIRECTIVE = /^\/\/\/?\s*@ts-(expect-error|ignore|nocheck)\b/;
const MULTI_LINE_DIRECTIVE = /^(?:\/|\*)*\s*@ts-(expect-error|ignore)\b/;

export function isTsDirective(comment: string): boolean {
  return comment.startsWith('//')
    ? SINGLE_LINE_DIRECTIVE.test(comment)
    : MULTI_LINE_DIRECTIVE.test(comment);
}

/**
 * Visits every comment in the file once. Every comment is leading or trailing trivia of some
 * token, so walking the tokens (`getChildren`, which includes punctuation and the end-of-file
 * token) and asking for both kinds of ranges at each covers them all.
 */
export function forEachComment(
  sourceFile: ts.SourceFile,
  visit: (range: ts.CommentRange, text: string) => void,
): void {
  const { text } = sourceFile;
  const seen = new Set<number>();
  const report = (ranges: ts.CommentRange[] | undefined): void => {
    if (ranges === undefined) return;
    for (const range of ranges) {
      if (seen.has(range.pos)) continue;
      seen.add(range.pos);
      visit(range, text.slice(range.pos, range.end));
    }
  };
  const walk = (node: ts.Node): void => {
    for (const child of node.getChildren(sourceFile)) {
      report(ts.getLeadingCommentRanges(text, child.getFullStart()));
      report(ts.getTrailingCommentRanges(text, child.getEnd()));
      walk(child);
    }
  };
  walk(sourceFile);
}

function unparenthesize(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function isAsUnknown(expression: ts.Expression): boolean {
  const inner = unparenthesize(expression);
  return (
    ts.isAsExpression(inner) && inner.type.kind === ts.SyntaxKind.UnknownKeyword
  );
}

const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self']);

/** `globalThis.name`, `window['name']`, ...: the global object's member, not a user object's. */
function globalMember(node: ts.Node): string | null {
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    GLOBAL_OBJECTS.has(node.expression.text)
  ) {
    return node.name.text;
  }
  if (
    ts.isElementAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    GLOBAL_OBJECTS.has(node.expression.text) &&
    ts.isStringLiteralLike(node.argumentExpression)
  ) {
    return node.argumentExpression.text;
  }
  return null;
}

/** An identifier that refers to something, as opposed to naming a declaration or a property. */
function isReference(
  node: ts.Identifier,
  parent: ts.Node | undefined,
): boolean {
  if (parent === undefined) return true;
  if (ts.isShorthandPropertyAssignment(parent)) return true;
  if ('name' in parent && (parent as { name?: ts.Node }).name === node) {
    return false;
  }
  if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
  return !(ts.isQualifiedName(parent) && parent.right === node);
}

/**
 * §5 `eval`: calls to eval or new Function. Any reference to `eval` counts (an alias is a call
 * waiting to happen, and strict mode forbids the name for anything else), as does the global
 * object's `eval` or `Function`; a plain `Function()` call is `new Function` without the `new`.
 * A user object's own `eval` method is left alone.
 */
function dynamicCode(
  node: ts.Node,
  parent: ts.Node | undefined,
): string | null {
  if (
    ts.isIdentifier(node) &&
    node.text === 'eval' &&
    isReference(node, parent)
  ) {
    return 'eval is not allowed';
  }
  const member = globalMember(node);
  if (member === 'eval') return 'eval is not allowed';
  if (member === 'Function') return 'Function is not allowed';
  if (ts.isNewExpression(node) || ts.isCallExpression(node)) {
    const callee = unparenthesize(node.expression);
    if (ts.isIdentifier(callee) && callee.text === 'Function') {
      return ts.isNewExpression(node)
        ? 'new Function is not allowed'
        : 'Function() is not allowed';
    }
  }
  return null;
}

function isTestSkip(node: ts.Node): boolean {
  if (ts.isPropertyAccessExpression(node)) {
    return (
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'test' &&
      node.name.text === 'skip'
    );
  }
  if (ts.isElementAccessExpression(node)) {
    return (
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'test' &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === 'skip'
    );
  }
  return false;
}

export function lintSourceFile(
  sourceFile: ts.SourceFile,
  rules: ReadonlySet<RuleId>,
  context: LintContext,
): RuleHit[] {
  const hits: RuleHit[] = [];
  const file = sourceFile.fileName;
  const hitAt = (
    rule: RuleId,
    pos: number,
    message: string = RULE_MESSAGES[rule],
  ): void => {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
    hits.push({ rule, file, line: line + 1, column: character + 1, message });
  };

  if (rules.has('ts-directive') && !context.isTestFile) {
    forEachComment(sourceFile, (range, text) => {
      if (isTsDirective(text)) hitAt('ts-directive', range.pos);
    });
  }
  if (rules.has('implicit-any')) {
    for (const diagnostic of context.implicitAny) {
      hits.push({
        rule: 'implicit-any',
        file,
        line: diagnostic.line,
        column: diagnostic.column,
        message: diagnostic.message,
      });
    }
  }

  const visit = (node: ts.Node, parent: ts.Node | undefined): void => {
    if (rules.has('explicit-any') && node.kind === ts.SyntaxKind.AnyKeyword) {
      hitAt('explicit-any', node.getStart(sourceFile));
    }
    if (
      rules.has('as-unknown-as') &&
      ts.isAsExpression(node) &&
      isAsUnknown(node.expression)
    ) {
      hitAt('as-unknown-as', node.getStart(sourceFile));
    }
    if (rules.has('non-null-assertion') && ts.isNonNullExpression(node)) {
      hitAt('non-null-assertion', node.getEnd() - 1);
    }
    if (rules.has('angle-cast') && ts.isTypeAssertionExpression(node)) {
      hitAt('angle-cast', node.getStart(sourceFile));
    }
    if (rules.has('eval')) {
      const message = dynamicCode(node, parent);
      if (message !== null) hitAt('eval', node.getStart(sourceFile), message);
    }
    if (
      rules.has('no-skipped-tests') &&
      context.isTestFile &&
      isTestSkip(node)
    ) {
      hitAt('no-skipped-tests', node.getStart(sourceFile));
    }
    ts.forEachChild(node, (child) => visit(child, node));
  };
  visit(sourceFile, undefined);

  return hits.sort((a, b) => a.line - b.line || a.column - b.column);
}

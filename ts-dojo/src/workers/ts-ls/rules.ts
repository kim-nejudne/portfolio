// The §5 AST rules, run by the ts-ls core's `lintAst`: one `ts.forEachChild` walk per user
// file plus a comment walk for `ts-directive`. Every hit carries the rule, the file, the line
// and the column. The ids, messages and the always-on set are src/verify/rules.ts. The pre-F13
// fixes widened `as-unknown-as` to every double assertion and added `type-assertion` and
// `any-expression`; the last reads types, so the walk gets the program's checker. After F13,
// `type-utils-import` flags every module specifier, and every `declare module` block, that names
// `@dojo/type-utils` outside tests.ts.
import ts from 'typescript';
import type { Diag, RuleHit } from '@/protocol/ts-ls';
import { RULE_MESSAGES, type RuleId } from '@/verify/rules';
import { TYPE_UTILS_MODULE } from '@/verify/type-utils';

export interface LintContext {
  /** tests.ts: `ts-directive` is skipped and `no-skipped-tests` applies. */
  isTestFile: boolean;
  /** The file's diagnostics with the §5 `implicit-any` codes (7006, 7031). */
  implicitAny: readonly Diag[];
  /** The project's checker, for `any-expression`. */
  checker: ts.TypeChecker;
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

function isAssertion(
  node: ts.Node,
): node is ts.AsExpression | ts.TypeAssertion {
  return ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);
}

/** `as const` and `<const>x`: checked by the compiler like any literal, so no escape. */
function isConstAssertion(node: ts.Node): boolean {
  return isAssertion(node) && ts.isConstTypeReference(node.type);
}

/**
 * `as-unknown-as`: an `as` or `<T>` whose unparenthesised operand is another one (`x as unknown
 * as T`, `x as object as T`, `<T><unknown>x`), unless the inner one is `as const`.
 */
function isDoubleAssertion(node: ts.Node): boolean {
  if (!isAssertion(node)) return false;
  const inner = unparenthesize(node.expression);
  return isAssertion(inner) && !isConstAssertion(inner);
}

function isImportOrExport(node: ts.Node): boolean {
  return (
    ts.isImportDeclaration(node) ||
    ts.isExportDeclaration(node) ||
    ts.isExternalModuleReference(node)
  );
}

/**
 * An expression whose value the code uses, as `any-expression` reads it (the walk never asks
 * inside a type): not a name that declares something or names a property (`#private`
 * included), not a module specifier, not the target of a plain `=` (a write), and not the
 * discarded value of an expression statement (an unused `yield`).
 */
function isUsedValue(node: ts.Node, parent: ts.Node | undefined): boolean {
  if (parent === undefined || !ts.isExpression(node)) return false;
  if (ts.isPrivateIdentifier(node)) return false;
  if ('name' in parent && (parent as { name?: ts.Node }).name === node) {
    return false;
  }
  if (ts.isStringLiteral(node) && isImportOrExport(parent)) return false;
  if (ts.isExpressionStatement(parent)) return false;
  if (
    ts.isBinaryExpression(parent) &&
    parent.left === node &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
  ) {
    return false;
  }
  return !ts.isIdentifier(node) || isReference(node, parent);
}

function hasTypeAny(checker: ts.TypeChecker, node: ts.Node): boolean {
  return (checker.getTypeAtLocation(node).flags & ts.TypeFlags.Any) !== 0;
}

/**
 * `any-expression`: a used value of type `any`, reported where the `any` first appears (none of
 * its operands is `any`), unless it flows straight into `unknown` (a declaration, a parameter
 * or an assertion of type `unknown` is its contextual type).
 */
function isAnyOrigin(
  checker: ts.TypeChecker,
  node: ts.Node,
  parent: ts.Node | undefined,
): boolean {
  if (!isUsedValue(node, parent) || !hasTypeAny(checker, node)) return false;
  let operandIsAny = false;
  ts.forEachChild(node, (child) => {
    if (isUsedValue(child, node) && hasTypeAny(checker, child)) {
      operandIsAny = true;
    }
  });
  if (operandIsAny) return false;
  const contextual = checker.getContextualType(node as ts.Expression);
  return (
    contextual === undefined || (contextual.flags & ts.TypeFlags.Unknown) === 0
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

/**
 * `type-utils-import`: a string literal naming `@dojo/type-utils` where a module goes: an import
 * or export declaration, `import x = require(…)`, an `import(…)` type or a dynamic `import(…)`.
 * A `declare module '@dojo/type-utils'` block counts too: in a script file it merges into the
 * ambient module and can hand its helpers to the global scope. A plain string imports nothing.
 */
function isTypeUtilsSpecifier(
  node: ts.Node,
  parent: ts.Node | undefined,
): boolean {
  if (!ts.isStringLiteral(node) || node.text !== TYPE_UTILS_MODULE)
    return false;
  if (parent === undefined) return false;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) {
    return parent.moduleSpecifier === node;
  }
  if (ts.isExternalModuleReference(parent)) return true;
  if (ts.isModuleDeclaration(parent)) return parent.name === node;
  if (ts.isLiteralTypeNode(parent)) {
    return parent.parent !== undefined && ts.isImportTypeNode(parent.parent);
  }
  return (
    ts.isCallExpression(parent) &&
    parent.expression.kind === ts.SyntaxKind.ImportKeyword
  );
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

  // `inType`: inside a type annotation, alias or literal type, where expressions are types.
  const visit = (
    node: ts.Node,
    parent: ts.Node | undefined,
    inType: boolean,
  ): void => {
    if (rules.has('explicit-any') && node.kind === ts.SyntaxKind.AnyKeyword) {
      hitAt('explicit-any', node.getStart(sourceFile));
    }
    if (rules.has('as-unknown-as') && isDoubleAssertion(node)) {
      hitAt('as-unknown-as', node.getStart(sourceFile));
    }
    if (
      rules.has('type-assertion') &&
      !context.isTestFile &&
      isAssertion(node) &&
      !isConstAssertion(node)
    ) {
      hitAt('type-assertion', node.getStart(sourceFile));
    }
    if (
      rules.has('any-expression') &&
      !context.isTestFile &&
      !inType &&
      isAnyOrigin(context.checker, node, parent)
    ) {
      hitAt('any-expression', node.getStart(sourceFile));
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
    if (
      rules.has('type-utils-import') &&
      !context.isTestFile &&
      isTypeUtilsSpecifier(node, parent)
    ) {
      hitAt('type-utils-import', node.getStart(sourceFile));
    }
    const childInType = inType || ts.isTypeNode(node);
    ts.forEachChild(node, (child) => visit(child, node, childInType));
  };
  visit(sourceFile, undefined, false);

  return hits.sort((a, b) => a.line - b.line || a.column - b.column);
}

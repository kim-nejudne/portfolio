// The §2 message protocol between the UI and the ts-ls worker, plus the §2 default compiler
// options. Both sides import this file; no literal is duplicated elsewhere. Invariants: every
// request carries a `requestId` and every reply echoes it; a reply about a file carries the
// file `version` it was computed against (a `versions` map when it is about several), and the
// client drops a reply older than the file's current version. Paths are virtual-FS paths
// (`/index.ts`, `/tests.ts`, a lesson's `/types/shapes.d.ts`); offsets are 0-based, lines and
// columns 1-based.
import type { RuleId } from '@/verify/rules';

/** tsconfig-shaped options, as exercise.yaml writes them (§3): strings for enums. */
export type CompilerOptionsJson = Record<
  string,
  boolean | number | string | readonly string[]
>;

/** §2 Compiler assets and options. `lib` is always explicit: TypeScript's default lib for es2025 pulls in DOM. */
export const DEFAULT_COMPILER_OPTIONS = {
  strict: true,
  target: 'es2025',
  module: 'esnext',
  moduleResolution: 'bundler',
  lib: ['es2025'],
  types: [],
  skipLibCheck: true,
  isolatedModules: true,
  useDefineForClassFields: true,
} as const satisfies CompilerOptionsJson;

export interface ProjectFile {
  path: string;
  text: string;
  /** The client's current version when a project is re-sent after a worker restart; 0 when absent. */
  version?: number;
}

/** `openProject { compilerOptions, files, libs, dtsFiles }` (§2). */
export interface OpenProjectSpec {
  /** Merged over DEFAULT_COMPILER_OPTIONS. */
  compilerOptions?: CompilerOptionsJson;
  /** The editable files. */
  files: ProjectFile[];
  /** Extra lib names appended to `lib` (`dom` for a lesson that needs the DOM). */
  libs?: string[];
  /** Lesson-supplied declaration files, read-only. */
  dtsFiles?: ProjectFile[];
}

export type DiagCategory = 'error' | 'warning' | 'suggestion' | 'message';

/** A ts.Diagnostic with its position resolved in the worker, so the UI never needs the SourceFile. */
export interface Diag {
  file: string;
  start: number;
  length: number;
  line: number;
  column: number;
  code: number;
  message: string;
  category: DiagCategory;
}

export interface DocTag {
  name: string;
  text: string;
}

export interface QuickInfoResult {
  kind: string;
  /** The display parts as one string, e.g. `const x: number`. */
  text: string;
  documentation: string;
  tags: DocTag[];
  start: number;
  length: number;
}

export interface CompletionEntry {
  name: string;
  kind: string;
  kindModifiers: string;
  sortText: string;
  insertText?: string;
}

export interface CompletionsResult {
  entries: CompletionEntry[];
  isIncomplete: boolean;
}

export interface CompletionDetailsResult {
  name: string;
  kind: string;
  text: string;
  documentation: string;
  tags: DocTag[];
}

export interface SignatureParameter {
  label: string;
  documentation: string;
}

export interface SignatureItem {
  label: string;
  documentation: string;
  parameters: SignatureParameter[];
}

export interface SignatureHelpResult {
  items: SignatureItem[];
  selectedItem: number;
  argumentIndex: number;
  argumentCount: number;
}

export interface DefinitionLocation {
  path: string;
  start: number;
  length: number;
  line: number;
  column: number;
}

/** One `^?` query: the comment's line, the `^` column, the offset queried on the line above. */
export interface TwoslashQuery {
  line: number;
  column: number;
  offset: number | null;
  text?: string;
  docs?: string;
  error?: string;
}

/** One import that survived emit (type-only ones are elided), with the specifier's span in `js`. */
export interface EmittedImport {
  specifier: string;
  /** 0-based span of the specifier text, quotes excluded. */
  start: number;
  end: number;
}

/** `module: "commonjs"` is the sandbox's fallback for a cyclic import graph (§2 Decisions). */
export type EmitModuleKind = 'commonjs';

export interface EmittedFile {
  path: string;
  /** JavaScript with an inline source map (`//# sourceMappingURL=data:...`). */
  js: string;
  /** The imports the sandbox loader rewrites to module URLs; empty for CommonJS output. */
  imports: EmittedImport[];
}

/** The §5 rule hit, with the column so the Tests tab can move the cursor to it. */
export interface RuleHit {
  rule: RuleId;
  file: string;
  line: number;
  column: number;
  message: string;
}

/** The §5 case shape. */
export interface TypeCase {
  name: string;
  ok: boolean;
  diagnostics: Diag[];
}

/** path → version, for replies about several files. */
export type FileVersions = Record<string, number>;

interface Request<T extends string> {
  type: T;
  requestId: number;
}

export type TsLsRequest =
  | Request<'init'>
  | (Request<'openProject'> & OpenProjectSpec)
  | (Request<'updateFile'> & { path: string; text: string; version: number })
  | (Request<'getDiagnostics'> & { paths: string[] })
  | (Request<'getQuickInfo'> & { path: string; offset: number })
  | (Request<'getCompletions'> & { path: string; offset: number })
  | (Request<'getCompletionDetails'> & {
      path: string;
      offset: number;
      name: string;
    })
  | (Request<'getSignatureHelp'> & { path: string; offset: number })
  | (Request<'getDefinition'> & { path: string; offset: number })
  | (Request<'getTwoslashQueries'> & { path: string })
  | (Request<'emit'> & { paths: string[]; module?: EmitModuleKind })
  | (Request<'lintAst'> & { paths: string[]; rules: RuleId[] })
  | (Request<'runTypeTests'> & { paths: string[] })
  /** F10 (Spec questions): the Settings page's compiler defaults, merged over the §2 defaults. */
  | (Request<'checkCompilerOptions'> & { compilerOptions: CompilerOptionsJson })
  | Request<'dispose'>;

export type TsLsRequestType = TsLsRequest['type'];

interface FileReply<T extends string> {
  type: T;
  requestId: number;
  path: string;
  version: number;
}

export type TsLsReply =
  | { type: 'ready'; requestId: number; tsVersion: string }
  | {
      type: 'diagnostics';
      requestId: number;
      diagnostics: Diag[];
      versions: FileVersions;
    }
  | (FileReply<'quickInfo'> & { info: QuickInfoResult | null })
  | (FileReply<'completions'> & { completions: CompletionsResult | null })
  | (FileReply<'completionDetails'> & {
      details: CompletionDetailsResult | null;
    })
  | (FileReply<'signatureHelp'> & { help: SignatureHelpResult | null })
  | (FileReply<'definition'> & { locations: DefinitionLocation[] })
  | (FileReply<'twoslash'> & { queries: TwoslashQuery[] })
  | {
      type: 'emitResult';
      requestId: number;
      files: EmittedFile[];
      versions: FileVersions;
    }
  | {
      type: 'astLint';
      requestId: number;
      hits: RuleHit[];
      versions: FileVersions;
    }
  | {
      type: 'typeTestResults';
      requestId: number;
      cases: TypeCase[];
      outsideCases: Diag[];
      versions: FileVersions;
    }
  /** TypeScript's messages about the options; [] when it accepts them. */
  | { type: 'compilerOptionsChecked'; requestId: number; errors: string[] }
  | {
      type: 'error';
      /** null when the failing message had no usable requestId. */
      requestId: number | null;
      message: string;
      stack?: string;
    };

export type TsLsReplyType = TsLsReply['type'];

export function isTsLsReply(value: unknown): value is TsLsReply {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string' &&
    'requestId' in value
  );
}

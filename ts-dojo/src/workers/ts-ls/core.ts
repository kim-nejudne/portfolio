// The ts-ls core (spec §2 Workers and protocol, Compiler assets and options; §4 Type feedback;
// §5 Type cases and Rules): one ts.LanguageService over a virtual file system, answering the
// §2 requests as plain method calls. Pure: no `self`, `postMessage`, `fetch` or DOM; the lib
// fetcher is injected, so Vitest and the content lint run this in Node (node/fetch-lib.ts) and
// adapter.ts puts it behind postMessage in the worker. One service lives across exercises:
// `openProject` swaps root files and options; the lib texts stay in `files` and the parsed lib
// SourceFiles stay in one shared DocumentRegistry, so libs are parsed once (§2, §9 Warm-up).
import ts from 'typescript';
import {
  createSystem,
  createVirtualCompilerHost,
  createVirtualLanguageServiceHost,
} from '@typescript/vfs';
import {
  DEFAULT_COMPILER_OPTIONS,
  type CompilerOptionsJson,
  type CompletionDetailsResult,
  type CompletionsResult,
  type DefinitionLocation,
  type Diag,
  type DiagCategory,
  type DocTag,
  type EmittedFile,
  type EmittedImport,
  type EmitModuleKind,
  type FileVersions,
  type OpenProjectSpec,
  type ProjectFile,
  type QuickInfoResult,
  type RuleHit,
  type SignatureHelpResult,
  type TwoslashQuery,
  type TypeCase,
} from '@/protocol/ts-ls';
import { groupIntoCases } from '@/verify/cases';
import {
  ALWAYS_ON_RULES,
  IMPLICIT_ANY_CODES,
  isRuleId,
  isTestFile,
  type RuleId,
} from '@/verify/rules';
import {
  AMBIENT_RUNTIME_DTS,
  AMBIENT_RUNTIME_PATH,
  AMBIENT_TEST_HARNESS_DTS,
  AMBIENT_TEST_HARNESS_PATH,
  AMBIENT_TYPE_UTILS_DTS,
  AMBIENT_TYPE_UTILS_PATH,
  isAmbientPath,
  needsAmbientRuntime,
  needsAmbientTests,
} from './ambient';
import { loadLibs, type FetchLib } from './libs';
import { lintSourceFile } from './rules';
import { findTwoslashQueries } from './twoslash';
import { findCases } from './type-tests';

/** A request the core cannot honour; the adapter turns it into an `error` reply. */
export class TsLsError extends Error {
  override readonly name = 'TsLsError';
}

export const TWOSLASH_NO_TARGET = 'Nothing above the ^ to query';
export const TWOSLASH_NO_SYMBOL =
  'Nothing to show here: point the ^ at a name on the line above';

export interface TsLsCoreOptions {
  fetchLib: FetchLib;
}

export interface FileResult {
  path: string;
  version: number;
}

export interface TsLsCore {
  /** The §9 warm-up: an empty project with the default options, its libs loaded and parsed. */
  init(): Promise<{ tsVersion: string }>;
  openProject(spec: OpenProjectSpec): Promise<void>;
  updateFile(path: string, text: string, version: number): void;
  getDiagnostics(paths: readonly string[]): {
    diagnostics: Diag[];
    versions: FileVersions;
  };
  getQuickInfo(
    path: string,
    offset: number,
  ): FileResult & { info: QuickInfoResult | null };
  getCompletions(
    path: string,
    offset: number,
  ): FileResult & { completions: CompletionsResult | null };
  getCompletionDetails(
    path: string,
    offset: number,
    name: string,
  ): FileResult & { details: CompletionDetailsResult | null };
  getSignatureHelp(
    path: string,
    offset: number,
  ): FileResult & { help: SignatureHelpResult | null };
  getDefinition(
    path: string,
    offset: number,
  ): FileResult & { locations: DefinitionLocation[] };
  getTwoslashQueries(path: string): FileResult & { queries: TwoslashQuery[] };
  emit(
    paths: readonly string[],
    module?: EmitModuleKind,
  ): {
    files: EmittedFile[];
    versions: FileVersions;
  };
  lintAst(
    paths: readonly string[],
    rules: readonly RuleId[],
  ): { hits: RuleHit[]; versions: FileVersions };
  runTypeTests(paths: readonly string[]): {
    cases: TypeCase[];
    outsideCases: Diag[];
    versions: FileVersions;
  };
  /**
   * F10 Settings: what TypeScript says about `compilerOptions` merged over the §2 defaults
   * (conversion errors, then the options and global diagnostics of an empty program). The open
   * project is not touched.
   */
  checkCompilerOptions(compilerOptions: CompilerOptionsJson): {
    errors: string[];
  };
  dispose(): void;
  /** The current program (tests, the content lint); undefined before init. */
  getProgram(): ts.Program | undefined;
  /** Every path in the open project: editable files, lesson .d.ts files and the ambient file. */
  projectPaths(): string[];
}

interface Project {
  options: ts.CompilerOptions;
  paths: string[];
  editable: Set<string>;
  versions: Map<string, number>;
  service: ts.LanguageService;
}

const CATEGORY: Record<ts.DiagnosticCategory, DiagCategory> = {
  [ts.DiagnosticCategory.Warning]: 'warning',
  [ts.DiagnosticCategory.Error]: 'error',
  [ts.DiagnosticCategory.Suggestion]: 'suggestion',
  [ts.DiagnosticCategory.Message]: 'message',
};

const FILE_EXTENSION = /\.(?:ts|tsx)$/;

/** Virtual-FS paths: absolute, normalised, a TypeScript file, outside the app's and the libs' names. */
export function validatePath(path: unknown, what: string): string {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new TsLsError(`${what}: ${String(path)} is not an absolute path`);
  }
  const segments = path.slice(1).split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) {
    throw new TsLsError(`${what}: ${path} is not a normalised path`);
  }
  if (!FILE_EXTENSION.test(path)) {
    throw new TsLsError(`${what}: ${path} is not a .ts, .tsx or .d.ts file`);
  }
  if (isAmbientPath(path)) {
    throw new TsLsError(`${what}: ${path} is reserved for ts-dojo`);
  }
  if (segments.length === 1 && /^lib\..+\.d\.ts$/.test(path.slice(1))) {
    throw new TsLsError(`${what}: ${path} is reserved for the compiler libs`);
  }
  return path;
}

function toJsonOptions(spec: OpenProjectSpec): CompilerOptionsJson {
  const merged: Record<string, CompilerOptionsJson[string]> = {
    ...DEFAULT_COMPILER_OPTIONS,
    ...spec.compilerOptions,
  };
  const base: unknown = merged['lib'];
  const baseLib: readonly string[] = isStringArray(base)
    ? base
    : typeof base === 'string'
      ? [base]
      : [];
  const lib = [...new Set([...baseLib, ...(spec.libs ?? [])])];
  return { ...merged, lib };
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((item: unknown) => typeof item === 'string')
  );
}

function partsToString(parts: ts.SymbolDisplayPart[] | undefined): string {
  return ts.displayPartsToString(parts);
}

function toTags(tags: ts.JSDocTagInfo[] | undefined): DocTag[] {
  return (tags ?? []).map((tag) => ({
    name: tag.name,
    text: partsToString(tag.text),
  }));
}

export function createTsLsCore(options: TsLsCoreOptions): TsLsCore {
  const files = new Map<string, string>();
  const sys = createSystem(files);
  const registry = ts.createDocumentRegistry(true, '/');
  const inFlight = new Map<string, Promise<void>>();
  let project: Project | null = null;

  // Script versions for the language service: one core-wide counter, so a project file never
  // repeats a version string across edits or projects (the shared registry would otherwise
  // hand the new project the old parse of a same-named file), while every lib stays at "0"
  // and is parsed once for the app's lifetime.
  let stamp = 0;
  const stamps = new Map<string, string>();
  const makeHost = (
    paths: readonly string[],
    compilerOptions: ts.CompilerOptions,
  ): ts.LanguageServiceHost => {
    const base = createVirtualLanguageServiceHost(
      sys,
      [...paths],
      compilerOptions,
      ts,
    ).languageServiceHost;
    return {
      ...base,
      getProjectVersion: () => String(stamp),
      getScriptVersion: (fileName) => stamps.get(fileName) ?? '0',
    };
  };

  const requireProject = (): Project => {
    if (project === null) {
      throw new TsLsError('no project is open: send openProject first');
    }
    return project;
  };

  const requireFile = (current: Project, path: string): number => {
    const version = current.versions.get(path);
    if (version === undefined) {
      throw new TsLsError(`${path} is not a file of the project`);
    }
    return version;
  };

  const requireProgram = (current: Project): ts.Program => {
    const program = current.service.getProgram();
    if (program === undefined)
      throw new TsLsError('the program is unavailable');
    return program;
  };

  const toDiag = (diagnostic: ts.Diagnostic, fallbackFile: string): Diag => {
    const start = diagnostic.start ?? 0;
    const position = diagnostic.file?.getLineAndCharacterOfPosition(start) ?? {
      line: 0,
      character: 0,
    };
    return {
      file: diagnostic.file?.fileName ?? fallbackFile,
      start,
      length: diagnostic.length ?? 0,
      line: position.line + 1,
      column: position.character + 1,
      code: diagnostic.code,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      category: CATEGORY[diagnostic.category],
    };
  };

  const fileDiagnostics = (current: Project, path: string): Diag[] =>
    [
      ...current.service.getSyntacticDiagnostics(path),
      ...current.service.getSemanticDiagnostics(path),
    ].map((diagnostic) => toDiag(diagnostic, path));

  const toLocation = (
    program: ts.Program,
    definition: ts.DefinitionInfo,
  ): DefinitionLocation => {
    const { start, length } = definition.textSpan;
    const position = program
      .getSourceFile(definition.fileName)
      ?.getLineAndCharacterOfPosition(start) ?? { line: 0, character: 0 };
    return {
      path: definition.fileName,
      start,
      length,
      line: position.line + 1,
      column: position.character + 1,
    };
  };

  const versionsOf = (
    current: Project,
    paths: readonly string[],
  ): FileVersions => {
    const versions: FileVersions = {};
    for (const path of paths) versions[path] = requireFile(current, path);
    return versions;
  };

  /**
   * §5 `implicit-any`: codes 7006 and 7031. With noImplicitAny off (the only case the rule is
   * for) the compiler reports implicit anys only as "a better type may be inferred" suggestions
   * under other codes, so the rule checks the same files once more with noImplicitAny on. The
   * second service shares the document registry, so the libs are not parsed again.
   */
  const implicitAnyDiagnostics = (
    current: Project,
    paths: readonly string[],
  ): Map<string, Diag[]> => {
    const service = ts.createLanguageService(
      makeHost(current.paths, { ...current.options, noImplicitAny: true }),
      registry,
    );
    try {
      const result = new Map<string, Diag[]>();
      for (const path of paths) {
        result.set(
          path,
          service
            .getSemanticDiagnostics(path)
            .filter((diagnostic) =>
              IMPLICIT_ANY_CODES.includes(diagnostic.code),
            )
            .map((diagnostic) => toDiag(diagnostic, path)),
        );
      }
      return result;
    } finally {
      service.dispose();
    }
  };

  const core: TsLsCore = {
    async init() {
      await core.openProject({ files: [] });
      return { tsVersion: ts.version };
    },

    async openProject(spec) {
      const entries: ProjectFile[] = [];
      for (const file of spec.files) {
        entries.push({ ...file, path: validatePath(file.path, 'files') });
      }
      for (const file of spec.dtsFiles ?? []) {
        const path = validatePath(file.path, 'dtsFiles');
        if (!path.endsWith('.d.ts')) {
          throw new TsLsError(`dtsFiles: ${path} is not a .d.ts file`);
        }
        entries.push({ ...file, path });
      }
      const seen = new Set<string>();
      for (const { path } of entries) {
        if (seen.has(path)) throw new TsLsError(`${path} is listed twice`);
        seen.add(path);
      }

      const { options: compilerOptions, errors } =
        ts.convertCompilerOptionsFromJson(toJsonOptions(spec), '/');
      if (errors.length > 0) {
        throw new TsLsError(
          `compilerOptions: ${errors
            .map((e) => ts.flattenDiagnosticMessageText(e.messageText, ' '))
            .join('; ')}`,
        );
      }
      const libNames = compilerOptions.lib ?? [];
      await loadLibs(libNames, files, options.fetchLib, inFlight);

      if (needsAmbientRuntime(libNames)) {
        entries.push({ path: AMBIENT_RUNTIME_PATH, text: AMBIENT_RUNTIME_DTS });
      }
      // §5: a project with a tests.ts sees the harness globals and `@dojo/type-utils`.
      if (needsAmbientTests(entries.map((entry) => entry.path))) {
        entries.push(
          { path: AMBIENT_TEST_HARNESS_PATH, text: AMBIENT_TEST_HARNESS_DTS },
          { path: AMBIENT_TYPE_UTILS_PATH, text: AMBIENT_TYPE_UTILS_DTS },
        );
      }
      const previous = project;
      if (previous !== null) {
        for (const path of previous.paths) {
          files.delete(path);
          stamps.delete(path);
        }
      }
      const paths: string[] = [];
      const versions = new Map<string, number>();
      for (const file of entries) {
        files.set(file.path, file.text);
        stamps.set(file.path, String(++stamp));
        versions.set(file.path, file.version ?? 0);
        paths.push(file.path);
      }
      const service = ts.createLanguageService(
        makeHost(paths, compilerOptions),
        registry,
      );
      // Build the program now (the §9 warm-up) and only then release the previous service,
      // so the lib SourceFiles it holds in the shared registry are reused, not re-parsed.
      service.getProgram();
      previous?.service.dispose();
      project = {
        options: compilerOptions,
        paths,
        editable: new Set(spec.files.map((file) => file.path)),
        versions,
        service,
      };
    },

    updateFile(path, text, version) {
      const current = requireProject();
      if (!current.editable.has(path)) {
        throw new TsLsError(`${path} is not an editable file of the project`);
      }
      files.set(path, text);
      stamps.set(path, String(++stamp));
      current.versions.set(path, version);
    },

    getDiagnostics(paths) {
      const current = requireProject();
      const versions = versionsOf(current, paths);
      const diagnostics: Diag[] = [];
      for (const path of paths) {
        diagnostics.push(...fileDiagnostics(current, path));
      }
      return { diagnostics, versions };
    },

    getQuickInfo(path, offset) {
      const current = requireProject();
      const version = requireFile(current, path);
      const info = current.service.getQuickInfoAtPosition(path, offset);
      return {
        path,
        version,
        info:
          info === undefined
            ? null
            : {
                kind: info.kind,
                text: partsToString(info.displayParts),
                documentation: partsToString(info.documentation),
                tags: toTags(info.tags),
                start: info.textSpan.start,
                length: info.textSpan.length,
              },
      };
    },

    getCompletions(path, offset) {
      const current = requireProject();
      const version = requireFile(current, path);
      const info = current.service.getCompletionsAtPosition(path, offset, {
        includeCompletionsWithInsertText: true,
      });
      return {
        path,
        version,
        completions:
          info === undefined
            ? null
            : {
                entries: info.entries.map((entry) => ({
                  name: entry.name,
                  kind: entry.kind,
                  kindModifiers: entry.kindModifiers ?? '',
                  sortText: entry.sortText,
                  ...(entry.insertText !== undefined
                    ? { insertText: entry.insertText }
                    : {}),
                })),
                isIncomplete: info.isIncomplete ?? false,
              },
      };
    },

    getCompletionDetails(path, offset, name) {
      const current = requireProject();
      const version = requireFile(current, path);
      const details = current.service.getCompletionEntryDetails(
        path,
        offset,
        name,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      return {
        path,
        version,
        details:
          details === undefined
            ? null
            : {
                name: details.name,
                kind: details.kind,
                text: partsToString(details.displayParts),
                documentation: partsToString(details.documentation),
                tags: toTags(details.tags),
              },
      };
    },

    getSignatureHelp(path, offset) {
      const current = requireProject();
      const version = requireFile(current, path);
      const help = current.service.getSignatureHelpItems(
        path,
        offset,
        undefined,
      );
      return {
        path,
        version,
        help:
          help === undefined
            ? null
            : {
                items: help.items.map((item) => ({
                  label:
                    partsToString(item.prefixDisplayParts) +
                    item.parameters
                      .map((parameter) => partsToString(parameter.displayParts))
                      .join(partsToString(item.separatorDisplayParts)) +
                    partsToString(item.suffixDisplayParts),
                  documentation: partsToString(item.documentation),
                  parameters: item.parameters.map((parameter) => ({
                    label: partsToString(parameter.displayParts),
                    documentation: partsToString(parameter.documentation),
                  })),
                })),
                selectedItem: help.selectedItemIndex,
                argumentIndex: help.argumentIndex,
                argumentCount: help.argumentCount,
              },
      };
    },

    getDefinition(path, offset) {
      const current = requireProject();
      const version = requireFile(current, path);
      const program = requireProgram(current);
      const definitions =
        current.service.getDefinitionAtPosition(path, offset) ?? [];
      return {
        path,
        version,
        locations: definitions.map((definition) =>
          toLocation(program, definition),
        ),
      };
    },

    getTwoslashQueries(path) {
      const current = requireProject();
      const version = requireFile(current, path);
      const text = files.get(path) ?? '';
      const queries = findTwoslashQueries(text).map((site): TwoslashQuery => {
        const base = {
          line: site.line,
          column: site.column,
          offset: site.offset,
        };
        if (site.offset === null) return { ...base, error: TWOSLASH_NO_TARGET };
        const info = current.service.getQuickInfoAtPosition(path, site.offset);
        if (info === undefined) return { ...base, error: TWOSLASH_NO_SYMBOL };
        const docs = partsToString(info.documentation);
        return {
          ...base,
          text: partsToString(info.displayParts),
          ...(docs.length > 0 ? { docs } : {}),
        };
      });
      return { path, version, queries };
    },

    emit(paths, module) {
      const current = requireProject();
      const versions = versionsOf(current, paths);
      const compilerOptions: ts.CompilerOptions = {
        ...current.options,
        ...(module === 'commonjs' ? { module: ts.ModuleKind.CommonJS } : {}),
        inlineSourceMap: true,
        inlineSources: true,
        sourceMap: false,
        declaration: false,
        declarationMap: false,
      };
      const emitted: EmittedFile[] = [];
      for (const path of paths) {
        if (path.endsWith('.d.ts')) {
          throw new TsLsError(`${path} is a declaration file: nothing to emit`);
        }
        const output = ts.transpileModule(files.get(path) ?? '', {
          compilerOptions,
          fileName: path,
          reportDiagnostics: false,
        });
        emitted.push({
          path,
          js: output.outputText,
          imports:
            module === 'commonjs' ? [] : emittedImports(output.outputText),
        });
      }
      return { files: emitted, versions };
    },

    lintAst(paths, rules) {
      const current = requireProject();
      for (const rule of rules) {
        if (!isRuleId(rule)) {
          throw new TsLsError(`unknown rule ${String(rule)}`);
        }
      }
      const active = new Set<RuleId>([...ALWAYS_ON_RULES, ...rules]);
      const versions = versionsOf(current, paths);
      const program = requireProgram(current);
      const implicitAny = active.has('implicit-any')
        ? implicitAnyDiagnostics(current, paths)
        : new Map<string, Diag[]>();
      const hits: RuleHit[] = [];
      for (const path of paths) {
        const sourceFile = program.getSourceFile(path);
        if (sourceFile === undefined) {
          throw new TsLsError(`${path} is not in the program`);
        }
        hits.push(
          ...lintSourceFile(sourceFile, active, {
            isTestFile: isTestFile(path),
            implicitAny: implicitAny.get(path) ?? [],
          }),
        );
      }
      return { hits, versions };
    },

    runTypeTests(paths) {
      const current = requireProject();
      const versions = versionsOf(current, paths);
      const program = requireProgram(current);
      const cases: TypeCase[] = [];
      const outsideCases: Diag[] = [];
      for (const path of paths) {
        const sourceFile = program.getSourceFile(path);
        if (sourceFile === undefined) {
          throw new TsLsError(`${path} is not in the program`);
        }
        const grouping = groupIntoCases(
          findCases(sourceFile),
          fileDiagnostics(current, path),
        );
        cases.push(...grouping.cases);
        outsideCases.push(...grouping.outsideCases);
      }
      return { cases, outsideCases, versions };
    },

    checkCompilerOptions(compilerOptions) {
      const message = (diagnostic: ts.Diagnostic): string =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
      const { options: converted, errors } = ts.convertCompilerOptionsFromJson(
        toJsonOptions({ compilerOptions, files: [] }),
        '/',
      );
      if (errors.length > 0) return { errors: errors.map(message) };
      const program = ts.createProgram({
        rootNames: [],
        options: converted,
        host: createVirtualCompilerHost(sys, converted, ts).compilerHost,
      });
      return {
        errors: [
          ...program.getOptionsDiagnostics(),
          ...program.getGlobalDiagnostics(),
        ].map(message),
      };
    },
    dispose() {
      project?.service.dispose();
      project = null;
      files.clear();
      stamps.clear();
    },

    getProgram() {
      return project?.service.getProgram();
    },

    projectPaths() {
      return project === null ? [] : [...project.paths];
    },
  };
  return core;
}

/**
 * The surviving imports of emitted JavaScript, from `ts.preProcessFile`, whose `pos` is the
 * opening quote and whose `end` leaves out the closing one; the span here is the bare
 * specifier, checked against the text (checked with typescript@6.0.3 on 17 October 2026).
 */
export function emittedImports(js: string): EmittedImport[] {
  return ts.preProcessFile(js, true, false).importedFiles.map((file) => {
    let start = file.pos + 1;
    if (js.slice(start, start + file.fileName.length) !== file.fileName) {
      start = js.indexOf(file.fileName, file.pos);
    }
    return {
      specifier: file.fileName,
      start,
      end: start + file.fileName.length,
    };
  });
}

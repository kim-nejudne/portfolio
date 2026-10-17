---
name: ts-worker
description: Reference for ts-dojo's compiler-in-the-browser plumbing — the §2 message protocol between the UI, the ts-ls worker and the sandbox worker (every message and field), the @typescript/vfs 1.6.5 setup, the lib file loading rules, the default compiler options, the ts.LanguageService call behind each request, and the invariants (requestId, file versions, stale replies). Use when writing or changing anything under src/workers, src/protocol, src/verify, the editor's TS extensions, scripts/copy-ts-libs.ts or scripts/content-lint.ts, so worker and UI code stay consistent across sessions.
---

# The compiler workers

docs/spec.md §2 (Components, Workers and protocol, Compiler assets and options), §4 (Type feedback, Running) and §5 (Verification) are the source. This file collects them so a session touching one side of a message sees the other side too. Where the spec leaves a payload open, the shape below is marked **proposed**; F2 fixes it in `src/protocol/` and this file is then updated to match.

## Shape

- **ts-ls worker**: one for the app's lifetime, started on app load. Holds a `ts.LanguageService` over a virtual file system (`@typescript/vfs`). Answers diagnostics, quick info, completions, signature help, definitions, twoslash queries, AST rule checks, type-test grouping and emit.
- **sandbox worker**: a fresh dedicated Worker per run, built from the transpiled modules (blob URLs), terminated at the deadline or on `:kill`. Its prelude provides the console shim and the test harness.
- Both cores are **pure modules** (`src/workers/ts-ls/core.ts`, `src/workers/sandbox/prelude.ts` and `loader.ts`) with thin `worker.ts` adapters, so `pnpm content:lint` and Vitest run them in Node without a browser. Nothing in a core touches `self`, `postMessage`, `fetch` or the DOM directly; the adapter injects them.
- The UI's **verifier** (`src/verify/`) is on the main thread: it sends the requests, assembles the §5 groups and the verdict.
- Message types live in `src/protocol/` and are imported by both sides. No duplicated literals.

## Invariants

1. Every request carries a `requestId`; every reply echoes it.
2. Every reply about a file carries the file `version` it was computed against. The UI drops a reply older than the file's current version. The `updateFile` version is monotonic per path.
3. There is no stop message for the sandbox: the UI calls `worker.terminate()`.
4. If the ts-ls worker crashes, the app restarts it, re-sends `openProject` and shows a banner for 5 s. Edits are never lost: the editor is the source of truth and files autosave (500 ms idle).
5. The editor accepts input before `ready`; the status chip reads "compiler loading" until then.
6. One language service lives across exercises: `openProject` swaps root files and options, which is cheap next to re-parsing lib files. Keep lib files in the same `Map` across projects, and share one `ts.createDocumentRegistry()` across services if a service is recreated, so libs are parsed once.

## UI → ts-ls

| Message | Fields (§2) | Backed by |
| --- | --- | --- |
| `init` | — | create the `System`, load the lib list for the default options, open an empty project (the §9 warm-up) |
| `openProject` | `compilerOptions`, `files`, `libs`, `dtsFiles` | merge options over the defaults; set root files; `knownLibFilesForCompilerOptions`; fetch missing libs; add read-only `.d.ts` files |
| `updateFile` | `path`, `text`, `version` | `files.set(path, text)`; `host.updateFile(ts.createSourceFile(...))` |
| `getDiagnostics` | `paths` | `getSyntacticDiagnostics` + `getSemanticDiagnostics` per path |
| `getQuickInfo` | `path`, `offset` | `getQuickInfoAtPosition` |
| `getCompletions` | `path`, `offset` | `getCompletionsAtPosition` |
| `getCompletionDetails` | `path`, `offset`, `name` | `getCompletionEntryDetails` |
| `getSignatureHelp` | `path`, `offset` | `getSignatureHelpItems` |
| `getDefinition` | `path`, `offset` | `getDefinitionAtPosition` |
| `getTwoslashQueries` | `path` | find lines matching `//\s*\^\?`; `getQuickInfoAtPosition` at the `^` column on the line above |
| `emit` | `paths` | `ts.transpileModule` per file with the project options, inline source map |
| `lintAst` | `paths`, `rules` | `ts.forEachChild` walk per §5 rule |
| `runTypeTests` | `paths` | AST walk of `tests.ts` for `cases*` tuple aliases and `@ts-expect-error` statements; group diagnostics by range |
| `dispose` | — | `service.dispose()` |

## ts-ls → UI

| Message | Payload |
| --- | --- |
| `ready` | `{ tsVersion }` (§2); `tsVersion` is `6.0.3` |
| `diagnostics` | **proposed** `{ requestId, diagnostics: Diag[], versions: Record<path, version> }` |
| `quickInfo` | **proposed** `{ requestId, path, version, info: { text, documentation, start, length } \| null }` |
| `completions` | **proposed** `{ requestId, path, version, entries: { name, kind, sortText, insertText? }[] }` |
| `completionDetails` | **proposed** `{ requestId, path, version, name, text, documentation }` |
| `signatureHelp` | **proposed** `{ requestId, path, version, help: { items, selectedItem, argumentIndex } \| null }` |
| `definition` | **proposed** `{ requestId, locations: { path, start, length, line, column }[] }` |
| `twoslash` | **proposed** `{ requestId, path, version, queries: { line, column, text?, error? }[] }`; one entry per `^?`, `error` when the query points at nothing (§12 F2) |
| `emitResult` | **proposed** `{ requestId, files: { path, js }[] }`; `js` has the inline source map |
| `astLint` | **proposed** `{ requestId, hits: { rule, file, line, message }[] }` (the §5 hit shape) |
| `typeTestResults` | **proposed** `{ requestId, cases: { name, ok, diagnostics: Diag[] }[], outsideCases: Diag[] }` (the §5 case shape; `outsideCases` fails Compiles with "test file does not compile") |
| `error` | **proposed** `{ requestId?, message, stack? }` |

**proposed** `Diag = { file, start, length, line, column, code, message, category: 'error' \| 'warning' \| 'suggestion' \| 'message' }`, derived from `ts.Diagnostic` with the position resolved once in the worker so the UI never needs the `SourceFile`.

## UI → sandbox and back

| Direction | Message | Fields (§2, §4) |
| --- | --- | --- |
| UI → sandbox | `run` | `modules` (path → transpiled JS), `entry`, `mode: 'run' \| 'test'`, `timeoutMs` (default 5000) |
| sandbox → UI | `console` | `level`, `args` (serialized: depth 3, cycle-safe, Error/Map/Set/Date/class names/functions readable), `loc` |
| sandbox → UI | `runtimeError` | `message`, `stack`, `loc` (TypeScript file and line through the inline source map) |
| sandbox → UI | `testStart`, `testResult`, `testSummary` | per §5: `name`, `status: 'pass' \| 'fail' \| 'timeout' \| 'skip'`, `message?`, `expected?`, `actual?`, `ms` |
| sandbox → UI | `done` | `durationMs`, `pendingTimers` |

Output caps (§4): 500 console entries or 200 KB, then one "output truncated" line. Deadline: the UI terminates the worker at `timeoutMs` and the status says "killed after N s". Entry settled with timers pending: status "still running (N timers)"; `:kill` terminates. In `mode: 'test'` the test file is the entry, the harness prelude collects `test(...)` calls while `tests.ts` evaluates and runs them one at a time, each with a 1 s timeout; the solution module's top-level code runs once when the test file imports it.

Module loading (§2 Decisions, §13): modules are loaded through blob-URL import rewriting, mirroring `moduleResolution: bundler` (extensionless specifiers resolve to the project's files); `transpileModule` elides type-only imports; a cycle falls back to CommonJS and still runs (§12 F4 needs fixtures for both); top-level `await` works in a single-file run. No bundler is shipped.

## Setting up the virtual file system

From `@typescript/vfs@1.6.5`'s `index.d.ts` (checked 17 October 2026):

```ts
export declare function createSystem(files: Map<string, string>): System;
export declare function createVirtualLanguageServiceHost(
  sys: System, rootFiles: string[], compilerOptions: CompilerOptions, ts: TS, customTransformers?: CustomTransformers,
): { languageServiceHost: LanguageServiceHost; updateFile: (sourceFile: SourceFile) => void; deleteFile: (sourceFile: SourceFile) => void };
export declare const knownLibFilesForCompilerOptions: (compilerOptions: CompilerOptions, ts: TS) => string[];
export declare function createVirtualTypeScriptEnvironment(
  sys: System, rootFiles: string[], ts: TS, compilerOptions?: CompilerOptions, customTransformers?: CustomTransformers,
): VirtualTypeScriptEnvironment; // { sys, languageService, getSourceFile, createFile, updateFile(fileName, content, replaceTextSpan?), deleteFile }
export declare const createDefaultMapFromCDN: (options, version, cache, ts, lzstring?, fetcher?, storer?) => Promise<Map<string, string>>; // NOT used, see below
```

The skeleton the core follows:

```ts
import ts from 'typescript';
import { createSystem, createVirtualLanguageServiceHost, knownLibFilesForCompilerOptions } from '@typescript/vfs';

const files = new Map<string, string>(); // '/lib.es2025.d.ts' → text, '/index.ts' → text, ...
const sys = createSystem(files);
const host = createVirtualLanguageServiceHost(sys, rootFiles, options, ts);
const service = ts.createLanguageService(host.languageServiceHost, registry); // registry = ts.createDocumentRegistry(), shared

// an edit
files.set(path, text);
host.updateFile(ts.createSourceFile(path, text, options.target ?? ts.ScriptTarget.ES2025));
```

Lib files live at the root of the virtual FS as `/lib.<name>.d.ts`, which is where the vfs host's `getDefaultLibFileName` looks. Project files live under `/` too (`/index.ts`, `/tests.ts`, `/types/*.d.ts`).

### Lib loading rules (§2 Compiler assets and options)

- `scripts/copy-ts-libs.ts` copies `node_modules/typescript/lib/lib.*.d.ts` into `public/ts/6.0.3/`. The worker fetches a lib on demand from `/ts/6.0.3/<name>` and stores it in `files`. The set fetched is exactly `knownLibFilesForCompilerOptions(options, ts)`; Prep confirms that for the default options it returns only ES files (its JSDoc warns it "will return a bit more than necessary (by including the dom)").
- `createDefaultMapFromCDN` is **not** used: it needs the network, writes `localStorage` (absent in workers) and always includes DOM.
- `es2025` libs load at app start (warm-up). `lib.dom.d.ts` (2,351,349 bytes raw, 323 KB brotli) loads once, the first time a project has `libs: [dom]`, and stays in the map.
- The service worker precaches `/ts/6.0.3/**` so all of this works offline (§9).
- Sizes for reference (§2): `typescript` 9,144,216 bytes raw, 1,531,825 brotli; ES chain `es5`–`es2025` 569,639 bytes; decorators 14 KB; scripthost 9 KB.

### Default compiler options (§2)

```json
{ "strict": true, "target": "es2025", "module": "esnext", "moduleResolution": "bundler",
  "lib": ["es2025"], "types": [], "skipLibCheck": true, "isolatedModules": true, "useDefineForClassFields": true }
```

`lib` is always set explicitly because TypeScript's default lib for `es2025` pulls in DOM. An exercise's `compilerOptions` merge over these; `libs: [dom]` adds `dom` to `lib`. The lesson that teaches a flag overrides it (`strictNullChecks: false` in 3.2, `noUncheckedIndexedAccess: true` in 16.1). `target`/`lib` `es2025` and script files under `isolatedModules` were confirmed valid with `typescript@6.0.3` on 17 October 2026.

### Ambient declarations the project must add

The ES lib declares no `console` and no timers (they live in `lib.dom.d.ts` and `@types/node`), so a plain `console.log` fails with TS2584 under the defaults. Every project therefore needs an ambient `.d.ts` the app adds (not a lesson): the sandbox's `console` shim, `setTimeout`/`clearTimeout`/`setInterval`/`clearInterval`/`queueMicrotask`, and the §5 test harness (`test`, `test.skip`, `expect` and its matchers) for `tests.ts`. The spec doesn't name these files; see "Spec questions" in docs/progress.md. Declare only what the sandbox really provides.

### `@dojo/type-utils`

The alias resolves inside the virtual FS to a vendored copy of type-challenges' `utils/index.d.ts` (MIT; names in §5). With `moduleResolution: bundler` either a `paths` entry or a file at `/node_modules/@dojo/type-utils/index.d.ts` resolves it; F7 picks one and this note follows.

## Type feedback timings (§4, §9)

- Diagnostics: a `@codemirror/lint` source asks for every project file 200 ms after typing stops. Budget: under 300 ms p95 for a 200-line file with the `es2025` lib, warm, measured by a Vitest benchmark on the core (§12 F2).
- Quick info: under 100 ms. Hover and `K`.
- Completions: on typing and `Ctrl-Space`; details when an item is selected.
- Twoslash widgets refresh with every diagnostics cycle; a query pointing at whitespace yields an error entry.
- Run of a trivial file including worker spawn: under 150 ms. ts-ls memory steady under 250 MB.

## Verification pieces that live in the worker (§5)

- **Type cases**: elements of a tuple type alias whose name starts with `cases`; the case name is a trailing `// name` comment or `case N`; each statement whose leading comment is `@ts-expect-error` is a case too; a case's range is the element's or statement's text range including the directive line. A case fails when any diagnostic falls inside its range; an unused `@ts-expect-error` yields TS2578 inside the range. Diagnostics in `tests.ts` outside any range fail Compiles.
- **Rules** (`lintAst`): walk each user file's `SourceFile` with `ts.forEachChild`; `ts-directive` (always; `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` outside `tests.ts`), `explicit-any` (`SyntaxKind.AnyKeyword`), `implicit-any` (codes 7006, 7031), `as-unknown-as`, `non-null-assertion`, `angle-cast`, `eval` (always; `eval` and `new Function`), `no-skipped-tests` (always; `test.skip` in `tests.ts`). Every hit: file, line, rule, message.
- **Emit**: `ts.transpileModule` per file with inline source maps; type-only imports elided.

The verdict itself (`ExerciseResult`, four groups, Compiles first) is assembled on the main thread in `src/verify/`.

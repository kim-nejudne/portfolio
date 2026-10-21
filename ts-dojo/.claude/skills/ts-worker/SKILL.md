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
- The UI's **verifier** (`src/verify/`) is on the main thread: it sends the requests, assembles the §5 groups and the verdict. `src/verify/rules.ts` (rule ids, messages, the always-on set) and `src/verify/cases.ts` (grouping diagnostics into case ranges) are imported by the worker core too.
- The **ts-ls client** (`src/workers/ts-ls/client.ts`, main thread, F2) owns the Worker: request ids, per-path versions, the stale-reply drop, `whenReady()`, a status for the header chip, and the §9 restart (terminate, respawn, `init` plus the last `openProject` with the current texts and versions, in-flight requests rejected with `WorkerRestartedError`; `failed` after three crashes in a row). `src/app/compiler.ts` holds the one instance (`getCompiler()`, `useCompilerStatus()`), started from `main.tsx` before the first render.
- Message types live in `src/protocol/ts-ls.ts` (F2) and are imported by both sides. No duplicated literals. Paths are virtual-FS absolute (`/index.ts`, `/tests.ts`, `/types/shapes.d.ts`; `/dojo/*` and `/lib.*.d.ts` are reserved), offsets 0-based, lines and columns 1-based.

## Invariants

1. Every request carries a `requestId`; every reply echoes it.
2. Every reply about a file carries the file `version` it was computed against. The UI drops a reply older than the file's current version. The `updateFile` version is monotonic per path.
3. There is no stop message for the sandbox: the UI calls `worker.terminate()`.
4. If the ts-ls worker crashes, the app restarts it, re-sends `openProject` and shows a banner for 5 s. Edits are never lost: the editor is the source of truth and files autosave (500 ms idle).
5. The editor accepts input before `ready`; the status chip reads "compiler loading" until then.
6. One language service lives across exercises: `openProject` swaps root files and options, which is cheap next to re-parsing lib files. Keep lib files in the same `Map` across projects, and share one `ts.createDocumentRegistry()` across services if a service is recreated, so libs are parsed once. F2 does exactly this: one `ts.createDocumentRegistry(true, '/')` per core; a new vfs host and service per `openProject`; project files get core-wide unique version strings (the host's `getScriptVersion` and `getProjectVersion` are overridden), because the registry keys entries by file name and version and would otherwise hand the next project the old parse of a same-named file; libs stay at version `"0"`; the previous service is disposed only after the new program is built, so the lib SourceFiles keep a reference and are reused (`core.test.ts` asserts identity).
7. `openProject`, `updateFile` and `dispose` have no reply (§2 lists none). The worker handles requests one at a time in arrival order, so a `getDiagnostics` sent right after an `openProject` answers once the project is open; a failure comes back as `error` with the request's id, which the client routes to `onError`.

## UI → ts-ls

| Message | Fields (§2) | Backed by |
| --- | --- | --- |
| `init` | — | open an empty project with the default options: the es2025 lib chain fetched and parsed (the §9 warm-up); replies `ready { tsVersion }` |
| `openProject` | `compilerOptions`, `files`, `libs`, `dtsFiles` (`ProjectFile = { path, text, version? }`) | merge `compilerOptions` over the defaults, append `libs` to `lib`, `ts.convertCompilerOptionsFromJson` (errors → `error`); `loadLibs` follows the reference chain of each `lib` entry; the lesson's `dtsFiles` (read-only) and `/dojo/runtime.d.ts` (unless the lib set has dom or webworker) join the root files; new host and service on the shared registry, `getProgram()` to warm, then the previous service is disposed. No reply |
| `updateFile` | `path`, `text`, `version` | editable files only (an `error` otherwise); `files.set(path, text)`, a new version stamp for the path, the `version` recorded for replies. No reply |
| `getDiagnostics` | `paths` | `getSyntacticDiagnostics` + `getSemanticDiagnostics` per path |
| `getQuickInfo` | `path`, `offset` | `getQuickInfoAtPosition` |
| `getCompletions` | `path`, `offset` | `getCompletionsAtPosition` |
| `getCompletionDetails` | `path`, `offset`, `name` | `getCompletionEntryDetails` |
| `getSignatureHelp` | `path`, `offset` | `getSignatureHelpItems` |
| `getDefinition` | `path`, `offset` | `getDefinitionAtPosition` |
| `getTwoslashQueries` | `path` | find lines matching `//\s*\^\?`; `getQuickInfoAtPosition` at the `^` column on the line above |
| `emit` | `paths` | `ts.transpileModule` per file with the project options plus `inlineSourceMap` and `inlineSources`; a `.d.ts` path is an `error` |
| `lintAst` | `paths`, `rules` | the requested rules plus the always-on ones (`ts-directive`, `eval`, `no-skipped-tests`); `ts.forEachChild` walk per file (`rules.ts`), a comment walk for `ts-directive`, a second check with `noImplicitAny` on for `implicit-any`; an unknown rule id is an `error` |
| `runTypeTests` | `paths` | AST walk of each path for top-level `cases*` tuple aliases and top-level `@ts-expect-error` statements (`type-tests.ts`); its syntactic plus semantic diagnostics grouped by range (`src/verify/cases.ts`) |
| `checkCompilerOptions` | `compilerOptions` | F10 (Spec questions): the Settings page's compiler defaults merged over the defaults as `openProject` merges them; `ts.convertCompilerOptionsFromJson` errors, else `getOptionsDiagnostics()` and `getGlobalDiagnostics()` of an empty `ts.createProgram` over `createVirtualCompilerHost`; the open project is not touched; no lib is fetched |
| `dispose` | — | `service.dispose()`, files and stamps cleared. No reply |

## ts-ls → UI

| Message | Payload |
| --- | --- |
| `ready` | `{ requestId, tsVersion }`; `tsVersion` is `6.0.3`; after `init`, so also after every restart |
| `diagnostics` | `{ requestId, diagnostics: Diag[], versions: Record<path, version> }` |
| `quickInfo` | `{ requestId, path, version, info: { kind, text, documentation, tags: { name, text }[], start, length } \| null }` |
| `completions` | `{ requestId, path, version, completions: { entries: { name, kind, kindModifiers, sortText, insertText? }[], isIncomplete } \| null }` |
| `completionDetails` | `{ requestId, path, version, details: { name, kind, text, documentation, tags } \| null }` |
| `signatureHelp` | `{ requestId, path, version, help: { items: { label, documentation, parameters: { label, documentation }[] }[], selectedItem, argumentIndex, argumentCount } \| null }` |
| `definition` | `{ requestId, path, version, locations: { path, start, length, line, column }[] }`; lib files come back as `/lib.*.d.ts` and the editor decides |
| `twoslash` | `{ requestId, path, version, queries: { line, column, offset, text?, docs?, error? }[] }`: one entry per `^?` line; `line` is the comment's (1-based), `column` the caret's (1-based), `offset` the 0-based position queried on the line above or null; `error` when nothing is above the caret or that position holds no symbol (whitespace) (§12 F2) |
| `emitResult` | `{ requestId, files: { path, js }[], versions }`; `js` ends with the inline source map |
| `astLint` | `{ requestId, hits: { rule, file, line, column, message }[], versions }` (the §5 hit shape plus the column) |
| `typeTestResults` | `{ requestId, cases: { name, ok, diagnostics: Diag[] }[], outsideCases: Diag[], versions }` (the §5 case shape; `outsideCases` fails Compiles with "test file does not compile") |
| `compilerOptionsChecked` | `{ requestId, errors: string[] }`: TypeScript's messages, [] when it accepts the options (F10) |
| `error` | `{ requestId: number \| null, message, stack? }`; `requestId` is null for a malformed message |

`Diag = { file, start, length, line, column, code, message, category: 'error' \| 'warning' \| 'suggestion' \| 'message' }`, derived from `ts.Diagnostic` with the position resolved once in the worker so the UI never needs the `SourceFile`. The source of truth for all of this is `src/protocol/ts-ls.ts`; the client's typed methods (`getDiagnostics(paths)`, `getQuickInfo(path, offset)`, ...) return the payload without the envelope and reject with `StaleReplyError`, `TsLsRequestError` or `WorkerRestartedError`.

## UI → sandbox and back

| Direction | Message | Fields (§2, §4) |
| --- | --- | --- |
| UI → sandbox | `run` | `modules` (path → transpiled JS), `entry`, `mode: 'run' \| 'test'`, `timeoutMs` (default 5000) |
| sandbox → UI | `console` | `level`, `args` (serialized: depth 3, cycle-safe, Error/Map/Set/Date/class names/functions readable), `loc` |
| sandbox → UI | `runtimeError` | `message`, `stack`, `loc` (TypeScript file and line through the inline source map) |
| sandbox → UI | `testStart`, `testResult`, `testSummary` | per §5: `name`, `status: 'pass' \| 'fail' \| 'timeout' \| 'skip'`, `message?`, `expected?`, `actual?`, `ms` |
| sandbox → UI | `done` | `durationMs`, `pendingTimers` |

Output caps (§4): 500 console entries or 200 KB, then one "output truncated" line. Deadline: the UI terminates the worker at `timeoutMs` and the status says "killed after N s". Entry settled with timers pending: status "still running (N timers)"; `:kill` terminates. In `mode: 'test'` the test file is the entry, the harness (`src/workers/sandbox/harness.ts`, installed by both worker adapters before the modules load) collects `test(...)` calls while `tests.ts` evaluates and runs them one at a time after the entry settles, each with a 1 s timeout (`TEST_TIMEOUT_MS`); the solution module's top-level code runs once when the test file imports it. The runner keeps the results in `RunState.tests` and `RunState.testSummary`. The same prelude, loader and harness run in Node inside a `worker_threads` Worker (`src/workers/sandbox/node/worker.ts`, spawned by `node/spawn.ts` under tsx) for the content lint and the tests, with `data:` URLs instead of blob URLs.

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

// an edit (core.ts overrides the host's getScriptVersion/getProjectVersion with core-wide
// stamps, so no SourceFile is built here; the service re-parses on the next request)
files.set(path, text);
stamps.set(path, String(++stamp));
```

Lib files live at the root of the virtual FS as `/lib.<name>.d.ts`, which is where the vfs host's `getDefaultLibFileName` looks. Project files live under `/` too (`/index.ts`, `/tests.ts`, `/types/*.d.ts`).

### Lib loading rules (§2 Compiler assets and options)

- `scripts/copy-ts-libs.ts` copies `node_modules/typescript/lib/lib.*.d.ts` (107 files, 3,783,805 bytes) into `public/ts/6.0.3/` (gitignored; `pnpm build` regenerates it). The worker fetches a lib on demand from `/ts/6.0.3/<name>` and stores it in `files`. **Prep (17 October 2026) found `knownLibFilesForCompilerOptions` unusable as the lib set:** it is a prefix slice of a hardcoded list that returns 101 names for the defaults (DOM, webworker, scripthost and five files 6.0.3 does not ship) and only `lib.d.ts` once the options have gone through `convertCompilerOptionsFromJson`. The proposal under "Spec questions" in docs/progress.md: resolve the set by following `/// <reference lib="…" />` from `lib.<name>.d.ts` for each `lib` entry (76 files for `es2025`, including `lib.decorators.d.ts` and `lib.decorators.legacy.d.ts`, which `lib.es5.d.ts` references), as `referenceChain` in `scripts/copy-ts-libs.test.ts` does. Kim accepted this with the F2 plan on 17 October 2026 (Deviations in docs/progress.md): `loadLibs` in `src/workers/ts-ls/libs.ts` follows the directives, parallel per level, one in-flight fetch per name, and a file joins `files` only after its references did, so a failed fetch leaves nothing half-loaded and a retry completes the chain.
- `createDefaultMapFromCDN` is **not** used: it needs the network, writes `localStorage` (absent in workers) and always includes DOM.
- `es2025` libs load at app start (warm-up). `lib.dom.d.ts` (2,349,483 bytes raw, about 323 KB brotli) loads once, the first time a project has `libs: [dom]`, and stays in the map.
- The service worker precaches `/ts/6.0.3/**` so all of this works offline (§9).
- Sizes measured in Prep (§2 corrected in docs/progress.md): ES chain from `lib.es2025.d.ts` 573,813 bytes (74 ES files 559,373 + the two decorators files 14,440); `lib.dom.d.ts` 2,349,483; scripthost 9,412; `typescript` itself 9,144,216 bytes raw and 1,531,825 brotli per §2 (not re-measured: F2 bundles it).

### Default compiler options (§2)

```json
{ "strict": true, "target": "es2025", "module": "esnext", "moduleResolution": "bundler",
  "lib": ["es2025"], "types": [], "skipLibCheck": true, "isolatedModules": true, "useDefineForClassFields": true }
```

`lib` is always set explicitly because TypeScript's default lib for `es2025` pulls in DOM. An exercise's `compilerOptions` merge over these; `libs: [dom]` adds `dom` to `lib`. The lesson that teaches a flag overrides it (`strictNullChecks: false` in 3.2, `noUncheckedIndexedAccess: true` in 16.1). `target`/`lib` `es2025` and script files under `isolatedModules` were confirmed valid with `typescript@6.0.3` on 17 October 2026.

### Ambient declarations the project must add

The ES lib declares no `console` and no timers (they live in `lib.dom.d.ts` and `@types/node`), so a plain `console.log` fails with TS2584 under the defaults. Decided at F2 (Spec questions in docs/progress.md): the core adds `/dojo/runtime.d.ts` (`src/workers/ts-ls/ambient.ts`) to every project whose lib set has neither `dom` nor `webworker` (those declare console and the timers themselves, and a second declaration would clash): `console.log/info/warn/error/debug`, `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`, `queueMicrotask`. F4 widened it to exactly what the sandbox shim provides; F6 added `/dojo/test-harness.d.ts` (`test`, `test.skip`, `expect` and the §5 matchers, mirroring `src/workers/sandbox/harness.ts`) and `/dojo/type-utils.d.ts`, both only when the project has a `tests.ts`. Paths under `/dojo/` are reserved, never editable and never a tab. Declare only what the sandbox really provides.

### `@dojo/type-utils`

The alias resolves inside the virtual FS to a vendored copy of type-challenges' `utils/index.d.ts` (MIT; names in §5). F6 settled the mechanism: `src/verify/type-utils.ts` holds the text as a `declare module '@dojo/type-utils' { ... }` ambient module, and the core adds it as `/dojo/type-utils.d.ts`, next to `/dojo/test-harness.d.ts` (the §5 `test`, `test.skip` and `expect` globals), to every project that has a `tests.ts` (`needsAmbientTests` in `src/workers/ts-ls/ambient.ts`). No `paths` entry, no `node_modules` file.

## Type feedback timings (§4, §9)

- Diagnostics: a `@codemirror/lint` source asks for every project file 200 ms after typing stops. Budget: under 300 ms p95 for a 200-line file with the `es2025` lib, warm, measured by a Vitest benchmark on the core (§12 F2).
- Quick info: under 100 ms. Hover and `K`.
- Completions: on typing and `Ctrl-Space`; details when an item is selected.
- Twoslash widgets refresh with every diagnostics cycle; a query pointing at whitespace yields an error entry.
- Run of a trivial file including worker spawn: under 150 ms. ts-ls memory steady under 250 MB.

## Verification pieces that live in the worker (§5)

- **Type cases** (`type-tests.ts`, `src/verify/cases.ts`): elements of a top-level tuple type alias whose name starts with `cases`; the case name is a trailing `// name` comment (a comma skipped) or `case N` counted in source order; each top-level statement whose leading comment is `@ts-expect-error` is a case too; a case's range is the element's or statement's text range extended back to the directive line. A case fails when any diagnostic overlaps its range; an unused `@ts-expect-error` yields TS2578 inside the range. Diagnostics in `tests.ts` outside any range are `outsideCases` and fail Compiles.
- **Rules** (`lintAst`, `rules.ts`): walk each user file's `SourceFile` with `ts.forEachChild`; `ts-directive` (always; the compiler's own `@ts-ignore` and `@ts-expect-error` comment forms plus `@ts-nocheck`, found by walking every comment through the token tree, outside `tests.ts`), `explicit-any` (`SyntaxKind.AnyKeyword`), `implicit-any` (codes 7006 and 7031 from a second check of the same files with `noImplicitAny` on, because with it off the compiler reports implicit anys only as suggestions under other codes), `as-unknown-as` (an `as` whose unparenthesised operand is `as unknown`), `non-null-assertion` (the column is the `!`), `angle-cast`, `eval` (always; any reference to `eval`, the global object's `eval` or `Function`, `new Function(...)`, `Function(...)`; a user object's own `eval` method is fine), `no-skipped-tests` (always; `test.skip` or `test['skip']` in `tests.ts`). Every hit: rule, file, line, column, message.
- **Emit**: `ts.transpileModule` per file with inline source maps; type-only imports elided.

The verdict itself (`ExerciseResult`, four groups, Compiles first) is assembled on the main thread in `src/verify/`.

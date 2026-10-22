// The compiler options of `/repl` (Kim's decision on 22 October 2026, Spec questions "/repl
// buffers are one project"): every buffer is compiled as a module, so scratch snippets opened
// from theory, most of them scripts, don't clash on a name they both declare. Imports between
// buffers work as before. The Settings compiler defaults go on top, so an explicit choice there
// wins. Exercises keep §2's defaults plus their own options (F10).
import type { CompilerOptionsJson } from '@/protocol/ts-ls';

export function replCompilerOptions(
  compilerDefaults: CompilerOptionsJson | undefined,
): CompilerOptionsJson {
  return { moduleDetection: 'force', ...compilerDefaults };
}

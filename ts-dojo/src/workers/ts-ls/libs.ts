// Lib files for the virtual FS (spec §2 Compiler assets and options). The worker fetches
// `lib.<name>.d.ts` on demand from /ts/<version>/ and keeps every text in the shared `files`
// Map for the app's lifetime, so a lib is fetched once however many projects use it. The set
// for a project is resolved by following the `/// <reference lib="..." />` directives from
// each `lib` entry, the way the compiler itself resolves them (76 files for es2025; the
// Deviations entry in docs/progress.md says why not knownLibFilesForCompilerOptions). Pure:
// the fetcher is injected, so Node tests and the content lint read node_modules instead.

export type FetchLib = (fileName: string) => Promise<string>;

export const LIB_REFERENCE = /\/\/\/\s*<reference\s+lib="([^"]+)"\s*\/>/g;

/** `es2025` → `lib.es2025.d.ts`; a file name is returned as is. */
export function libFileName(name: string): string {
  const lower = name.toLowerCase();
  return lower.startsWith('lib.') && lower.endsWith('.d.ts')
    ? lower
    : `lib.${lower}.d.ts`;
}

/** Where the vfs host looks for a lib: the root of the virtual FS. */
export function libPath(fileName: string): string {
  return `/${fileName}`;
}

/** The lib file names a lib file references. */
export function parseLibReferences(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(LIB_REFERENCE)) {
    names.push(libFileName(match[1] as string));
  }
  return names;
}

/**
 * Loads `fileNames` and, recursively, everything they reference, fetching only what `files`
 * does not hold yet; the references of one file are fetched in parallel. `inFlight` dedupes
 * concurrent loads of the same file. Returns the names fetched by this call, in the order they
 * arrived.
 */
export async function loadLibs(
  fileNames: readonly string[],
  files: Map<string, string>,
  fetchLib: FetchLib,
  inFlight: Map<string, Promise<void>> = new Map(),
): Promise<string[]> {
  const fetched: string[] = [];
  const load = (name: string): Promise<void> => {
    const pending = inFlight.get(name);
    if (pending !== undefined) return pending;
    if (files.has(libPath(name))) return Promise.resolve();
    const promise = (async () => {
      const text = await fetchLib(name);
      fetched.push(name);
      // The file joins `files` only once everything it references is there, so a failed
      // fetch below never leaves a lib whose references would be skipped on a retry.
      await Promise.all(parseLibReferences(text).map(load));
      files.set(libPath(name), text);
    })();
    inFlight.set(name, promise);
    // Clean up on both outcomes without creating a second rejected promise nobody awaits.
    const forget = (): void => {
      inFlight.delete(name);
    };
    void promise.then(forget, forget);
    return promise;
  };
  await Promise.all(fileNames.map(load));
  return fetched;
}

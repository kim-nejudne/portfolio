// The browser registry's glob keys (src/content/registry.ts). The globs go through the
// `@content` alias the content plugin resolves to the tree being built (content/, or
// fixtures/content/ in the e2e build), and Vite keys each match by its path from the project
// root: `/fixtures/content/modules/…`. The registry speaks repository-relative `content/…`
// paths whichever tree it was built from (build-registry.ts), as the Node loader does.

/** `/fixtures/content/x` with root `fixtures/content` → `content/x`. */
export function registryPath(key: string, root: string): string {
  const prefix = `/${root}/`;
  if (!key.startsWith(prefix)) {
    throw new Error(`glob key ${key} is not under /${root}/`);
  }
  return `content/${key.slice(prefix.length)}`;
}

/** Every key of a glob result as a registry path. */
export function registryPaths<T>(
  record: Record<string, T>,
  root: string,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      registryPath(key, root),
      value,
    ]),
  );
}

// File tabs (§4 Multi-file exercises): the pure part of `:b <file>`, `:ls`, `:bnext`, `:bprev`.
// `:b` takes a full path, a basename, or a unique prefix of either; `:ls` prints Vim's list
// with `%a` on the current buffer. The editor component owns the states and the switching.

/** The path `:b name` means among `paths`, or null when none or several match. */
export function resolveBuffer(
  name: string,
  paths: readonly string[],
): string | null {
  const wanted = name.trim();
  if (wanted === '') return null;
  const exact = paths.find((p) => p === wanted || basename(p) === wanted);
  if (exact !== undefined) return exact;
  const prefixed = paths.filter(
    (p) => p.startsWith(wanted) || basename(p).startsWith(wanted),
  );
  return prefixed.length === 1 ? (prefixed[0] ?? null) : null;
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** The path after `current` (or before, with `step` -1), wrapping around. */
export function cycleBuffer(
  current: string,
  paths: readonly string[],
  step: 1 | -1,
): string | null {
  if (paths.length === 0) return null;
  const index = paths.indexOf(current);
  const next = (index + step + paths.length) % paths.length;
  return paths[next] ?? null;
}

/** `:ls` as Vim prints it: number, flags (`%a` current), the name, a `[RO]` for a read-only file. */
export function listBuffers(
  paths: readonly string[],
  current: string,
  readOnly: ReadonlySet<string> = new Set(),
): string {
  return paths
    .map((path, index) => {
      const flags = path === current ? '%a' : '  ';
      const ro = readOnly.has(path) ? ' [RO]' : '';
      return `${String(index + 1).padStart(2)} ${flags} "${basename(path)}"${ro}`;
    })
    .join('\n');
}

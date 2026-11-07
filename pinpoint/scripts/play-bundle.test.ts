import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Static `import … from`, `export … from` and bare `import '…'`; never `import(…)`, a lazy chunk. */
const STATIC_IMPORT = /^\s*(?:import|export)\s(?:[^'";]*?\sfrom\s)?['"]([^'"]+)['"]/gm;

function resolveImport(from: string, spec: string): string | null {
  let path: string;
  if (spec.startsWith('#shared/')) path = join(ROOT, 'shared', spec.slice('#shared/'.length));
  else if (spec.startsWith('.')) path = resolve(dirname(from), spec);
  else return null; // a package
  for (const candidate of [path, path.replace(/\.js$/, '.ts'), path.replace(/\.js$/, '.tsx')]) {
    if (/\.(ts|tsx)$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  if (/\.css$/.test(path)) return null;
  throw new Error(`Cannot resolve ${spec} from ${from}`);
}

/** Every source file the entry pulls in without a dynamic import: what lands in its chunk. */
function staticGraph(entry: string): string[] {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      const target = resolveImport(file, spec!);
      if (target && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return [...seen].map((f) => f.slice(ROOT.length + 1));
}

describe('the play bundle', () => {
  it('pulls in no admin module: the admin loads only through its lazy route', () => {
    const graph = staticGraph(join(ROOT, 'client/src/main.tsx'));
    expect(graph).toContain('client/src/pages/Play.tsx');
    expect(graph.filter((f) => /admin/i.test(f))).toEqual([]);
    // The walker does see admin modules when they are imported statically.
    expect(staticGraph(join(ROOT, 'client/src/pages/Admin.tsx'))).toContain(
      'client/src/lib/adminCategories.ts',
    );
  });
});

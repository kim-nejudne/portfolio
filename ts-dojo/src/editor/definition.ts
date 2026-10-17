// Go to definition (§4: `gd`, through `:def`, "across the exercise's files"). ts-ls answers with
// virtual-FS locations; one inside the project opens that file's tab at the symbol, one in a
// lib file or the app's ambient declarations is reported (there is no tab for it).
import type { DefinitionLocation } from '@/protocol/ts-ls';

export type DefinitionTarget =
  | { kind: 'open'; path: string; offset: number }
  | { kind: 'outside'; path: string }
  | { kind: 'none' };

/** The first location that is a project file, else the first location, else nothing. */
export function pickDefinition(
  locations: readonly DefinitionLocation[],
  projectPaths: readonly string[],
): DefinitionTarget {
  const first = locations[0];
  if (first === undefined) return { kind: 'none' };
  const inProject = locations.find((l) => projectPaths.includes(l.path));
  if (inProject !== undefined) {
    return { kind: 'open', path: inProject.path, offset: inProject.start };
  }
  return { kind: 'outside', path: first.path };
}

/** "defined in lib.es2025.d.ts": the file name without the virtual root. */
export function describeOutside(path: string): string {
  return `defined in ${path.replace(/^\//, '')}`;
}

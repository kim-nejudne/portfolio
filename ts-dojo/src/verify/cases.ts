// §5 Type cases: the grouping of a test file's diagnostics into cases. The ts-ls worker finds
// the case ranges by walking the tests.ts AST (src/workers/ts-ls/type-tests.ts) and calls this
// to group; a case fails when any diagnostic falls inside its range, and a diagnostic outside
// every range fails the Compiles group with the tests.ts note (F7; `TEST_FILE_NOTE`).
import type { Diag, TypeCase } from '@/protocol/ts-ls';

/** A case's text range in its file: [start, end), including a leading @ts-expect-error line. */
export interface CaseRange {
  name: string;
  start: number;
  end: number;
}

export interface TypeCaseGrouping {
  cases: TypeCase[];
  /** Diagnostics that overlap no case range: tests.ts does not compile against the code. */
  outsideCases: Diag[];
}

/** A zero-length diagnostic at `start` counts as one character, so it still lands in a case. */
export function overlaps(diagnostic: Diag, range: CaseRange): boolean {
  const end = diagnostic.start + Math.max(diagnostic.length, 1);
  return diagnostic.start < range.end && end > range.start;
}

/**
 * Groups the diagnostics of one file into the file's cases. A diagnostic that overlaps several
 * ranges fails each of them; the cases come back in the order given.
 */
export function groupIntoCases(
  cases: readonly CaseRange[],
  diagnostics: readonly Diag[],
): TypeCaseGrouping {
  const grouped = cases.map((range): TypeCase => ({
    name: range.name,
    ok: true,
    diagnostics: [],
  }));
  const outsideCases: Diag[] = [];
  for (const diagnostic of diagnostics) {
    let placed = false;
    cases.forEach((range, index) => {
      if (overlaps(diagnostic, range)) {
        const target = grouped[index] as TypeCase;
        target.ok = false;
        target.diagnostics.push(diagnostic);
        placed = true;
      }
    });
    if (!placed) outsideCases.push(diagnostic);
  }
  return { cases: grouped, outsideCases };
}

// Diagnostics in the editor (§4 Type feedback): a `@codemirror/lint` source that asks ts-ls for
// the diagnostics of every project file 200 ms after typing stops (DIAGNOSTICS_DELAY_MS), shows
// the current file's as squiggles and gutter marks, hands every file's to the page for the
// Problems list, and refreshes the `^?` widgets in the same cycle. A reply the client drops as
// stale (the file changed again) keeps the previous squiggles until the next cycle; `]d`/`[d`
// move a plain cursor between them (`@codemirror/lint`'s own commands select the range, which
// Vim turns into visual mode).
import {
  forEachDiagnostic,
  linter,
  lintGutter,
  type Diagnostic as CmDiagnostic,
} from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { Diag, DiagCategory, TwoslashQuery } from '@/protocol/ts-ls';
import type { TsLsClient } from '@/workers/ts-ls/client';
import { filePath } from './file-path';
import { setTwoslashQueries } from './twoslash';

/** §4: "200 ms after typing stops"; §12 F3 asks for squiggles within 300 ms. */
export const DIAGNOSTICS_DELAY_MS = 200;

const SEVERITY: Record<DiagCategory, CmDiagnostic['severity']> = {
  error: 'error',
  warning: 'warning',
  suggestion: 'hint',
  message: 'info',
};

/** A ts-ls Diag of the open file as a CodeMirror diagnostic, clamped to the document. */
export function toCmDiagnostic(diag: Diag, docLength: number): CmDiagnostic {
  const from = Math.min(diag.start, docLength);
  const to = Math.min(Math.max(diag.start + diag.length, from), docLength);
  return {
    from,
    to,
    severity: SEVERITY[diag.category],
    message: diag.message,
    source: `TS${String(diag.code)}`,
  };
}

/** The current file's diagnostics, as CodeMirror shows them. */
export function diagnosticsForFile(
  all: readonly Diag[],
  path: string,
  docLength: number,
): CmDiagnostic[] {
  return all
    .filter((d) => d.file === path)
    .map((d) => toCmDiagnostic(d, docLength));
}

export interface DiagnosticsSourceOptions {
  compiler: Pick<TsLsClient, 'getDiagnostics' | 'getTwoslashQueries'>;
  /** Every project path, read at request time (the editable files). */
  paths: () => string[];
  /** Every file's diagnostics after each cycle, for the Problems list. */
  onDiagnostics?: (diagnostics: Diag[]) => void;
}

/** The lint source plus the gutter; one per editor, shared by every file state. */
export function tsDiagnostics(options: DiagnosticsSourceOptions): Extension {
  const last = new Map<string, CmDiagnostic[]>();
  const source = async (view: EditorView): Promise<CmDiagnostic[]> => {
    const path = view.state.facet(filePath);
    try {
      const { diagnostics } = await options.compiler.getDiagnostics(
        options.paths(),
      );
      options.onDiagnostics?.(diagnostics);
      const own = diagnosticsForFile(diagnostics, path, view.state.doc.length);
      last.set(path, own);
      refreshTwoslash(view, options.compiler, path);
      return own;
    } catch {
      // Stale (the file changed again, a new cycle is coming) or the worker restarting.
      return last.get(path) ?? [];
    }
  };
  return [linter(source, { delay: DIAGNOSTICS_DELAY_MS }), lintGutter()];
}

function refreshTwoslash(
  view: EditorView,
  compiler: Pick<TsLsClient, 'getTwoslashQueries'>,
  path: string,
): void {
  compiler
    .getTwoslashQueries(path)
    .then((queries: TwoslashQuery[]) => {
      if (view.state.facet(filePath) !== path) return;
      view.dispatch({ effects: setTwoslashQueries.of(queries) });
    })
    .catch(() => undefined);
}

/** The start of the diagnostic after (or before, with step -1) `pos`, wrapping; null when there is none. */
export function nextDiagnosticStart(
  starts: readonly number[],
  pos: number,
  step: 1 | -1,
): number | null {
  if (starts.length === 0) return null;
  const sorted = [...new Set(starts)].sort((a, b) => a - b);
  const candidates =
    step === 1 ? sorted.filter((s) => s > pos) : sorted.filter((s) => s < pos);
  if (candidates.length > 0) {
    return step === 1 ? (candidates[0] ?? null) : (candidates.at(-1) ?? null);
  }
  return step === 1 ? (sorted[0] ?? null) : (sorted.at(-1) ?? null);
}

/** `:dnext` / `:dprev` (§4: `]d` and `[d` move between diagnostics): the cursor, not a selection. */
export function moveToDiagnostic(view: EditorView, step: 1 | -1): boolean {
  const starts: number[] = [];
  forEachDiagnostic(view.state, (_d, from) => {
    starts.push(from);
  });
  const target = nextDiagnosticStart(
    starts,
    view.state.selection.main.head,
    step,
  );
  if (target === null) return false;
  view.dispatch({ selection: { anchor: target }, scrollIntoView: true });
  return true;
}

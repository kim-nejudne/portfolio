// The pure parts of the §4 type feedback: diagnostics mapped for CodeMirror (squiggle ranges,
// severities, the current file only), completion entries mapped and the trigger rule
// (typing, `.`, Ctrl-Space), quick info text, definition targets across files, and the
// signature line with its active parameter. The in-browser behaviour is Playwright's.
import { EditorState } from '@codemirror/state';
import type { ViewUpdate } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import type { Diag } from '@/protocol/ts-ls';
import { completionType, shouldComplete, toCompletion } from './completions.ts';
import { describeOutside, pickDefinition } from './definition.ts';
import {
  DIAGNOSTICS_DELAY_MS,
  diagnosticsForFile,
  needsDiagnosticsRefresh,
  nextDiagnosticStart,
  refreshDiagnostics,
  toCmDiagnostic,
} from './diagnostics.ts';
import { infoText } from './quick-info.ts';
import { signatureLines, SIGNATURE_TRIGGERS } from './signature-help.ts';

const diag = (over: Partial<Diag>): Diag => ({
  file: '/index.ts',
  start: 6,
  length: 1,
  line: 1,
  column: 7,
  code: 2322,
  message: "Type 'string' is not assignable to type 'number'.",
  category: 'error',
  ...over,
});

describe('diagnostics (§4: squiggles 200 ms after typing stops)', () => {
  it('waits the §4 200 ms, under the §12 300 ms', () => {
    expect(DIAGNOSTICS_DELAY_MS).toBe(200);
    expect(DIAGNOSTICS_DELAY_MS).toBeLessThan(300);
  });

  it('maps a Diag to a CodeMirror diagnostic with its range, severity and code', () => {
    expect(toCmDiagnostic(diag({}), 100)).toEqual({
      from: 6,
      to: 7,
      severity: 'error',
      message: "Type 'string' is not assignable to type 'number'.",
      source: 'TS2322',
    });
    expect(toCmDiagnostic(diag({ category: 'warning' }), 100).severity).toBe(
      'warning',
    );
    expect(toCmDiagnostic(diag({ category: 'suggestion' }), 100).severity).toBe(
      'hint',
    );
    expect(toCmDiagnostic(diag({ category: 'message' }), 100).severity).toBe(
      'info',
    );
  });

  it('clamps a range past the end of a document that shrank meanwhile', () => {
    expect(toCmDiagnostic(diag({ start: 50, length: 10 }), 55)).toMatchObject({
      from: 50,
      to: 55,
    });
    expect(toCmDiagnostic(diag({ start: 80, length: 10 }), 55)).toMatchObject({
      from: 55,
      to: 55,
    });
  });

  it(']d and [d go to the next or previous diagnostic start and wrap; a cursor, never a selection', () => {
    const starts = [40, 10, 25];
    expect(nextDiagnosticStart(starts, 0, 1)).toBe(10);
    expect(nextDiagnosticStart(starts, 10, 1)).toBe(25);
    expect(nextDiagnosticStart(starts, 30, 1)).toBe(40);
    expect(nextDiagnosticStart(starts, 40, 1)).toBe(10);
    expect(nextDiagnosticStart(starts, 30, -1)).toBe(25);
    expect(nextDiagnosticStart(starts, 10, -1)).toBe(40);
    expect(nextDiagnosticStart(starts, 0, -1)).toBe(40);
    expect(nextDiagnosticStart([], 5, 1)).toBeNull();
  });

  it('keeps only the open file (the others go to the Problems list)', () => {
    const all = [diag({}), diag({ file: '/shapes.ts', start: 1 })];
    expect(diagnosticsForFile(all, '/index.ts', 100)).toHaveLength(1);
    expect(diagnosticsForFile(all, '/shapes.ts', 100)[0]?.from).toBe(1);
    expect(diagnosticsForFile(all, '/tests.ts', 100)).toEqual([]);
  });
});

describe('completions (§4)', () => {
  it('asks while a word is typed, right after a dot, or on Ctrl-Space; not in whitespace', () => {
    expect(shouldComplete('const x = Ma', false)).toBe(true);
    expect(shouldComplete('Math.', false)).toBe(true);
    expect(shouldComplete('const x = ', false)).toBe(false);
    expect(shouldComplete('', false)).toBe(false);
    expect(shouldComplete('const x = ', true)).toBe(true);
  });

  it('maps an entry to a completion with its type, insert text and sort order', () => {
    expect(
      toCompletion({
        name: 'toFixed',
        kind: 'method',
        kindModifiers: '',
        sortText: '11',
      }),
    ).toEqual({ label: 'toFixed', type: 'method', boost: -11 });
    expect(
      toCompletion({
        name: 'my-prop',
        kind: 'property',
        kindModifiers: '',
        sortText: '0',
        insertText: "['my-prop']",
      }),
    ).toMatchObject({ apply: "['my-prop']", type: 'property' });
    expect(completionType('const')).toBe('constant');
    expect(completionType('interface')).toBe('interface');
    expect(completionType('something new')).toBe('text');
  });
});

describe('quick info text (§4: the signature and the JSDoc)', () => {
  it('keeps the signature, trims the docs and formats the tags', () => {
    expect(
      infoText({
        text: 'function area(shape: Shape): number',
        documentation: 'The area of a shape, in square units.\n',
        tags: [
          { name: 'param', text: 'shape the shape' },
          { name: 'deprecated', text: '' },
        ],
      }),
    ).toEqual({
      signature: 'function area(shape: Shape): number',
      documentation: 'The area of a shape, in square units.',
      tags: ['@param shape the shape', '@deprecated'],
    });
  });
});

describe('go to definition (§4: across the exercise files)', () => {
  const paths = ['/index.ts', '/shapes.ts'];
  const at = (path: string, start: number) => ({
    path,
    start,
    length: 4,
    line: 1,
    column: 1,
  });

  it('opens a project file at the symbol, prefers one over a lib location', () => {
    expect(pickDefinition([at('/shapes.ts', 42)], paths)).toEqual({
      kind: 'open',
      path: '/shapes.ts',
      offset: 42,
    });
    expect(
      pickDefinition([at('/lib.es5.d.ts', 1), at('/index.ts', 3)], paths),
    ).toEqual({ kind: 'open', path: '/index.ts', offset: 3 });
  });

  it('reports a definition outside the project, or none', () => {
    expect(pickDefinition([at('/lib.es2025.d.ts', 10)], paths)).toEqual({
      kind: 'outside',
      path: '/lib.es2025.d.ts',
    });
    expect(describeOutside('/lib.es2025.d.ts')).toBe(
      'defined in lib.es2025.d.ts',
    );
    expect(pickDefinition([], paths)).toEqual({ kind: 'none' });
  });
});

describe('signature help (§4: on ( and ,)', () => {
  it('triggers on ( and , only', () => {
    expect([...SIGNATURE_TRIGGERS].sort()).toEqual(['(', ',']);
  });

  it('shows the selected signature with the active parameter and its docs', () => {
    expect(
      signatureLines({
        items: [
          {
            label: 'area(shape: Shape): number',
            documentation: 'The area.',
            parameters: [{ label: 'shape: Shape', documentation: 'the shape' }],
          },
        ],
        selectedItem: 0,
        argumentIndex: 0,
        argumentCount: 1,
      }),
    ).toEqual({
      label: 'area(shape: Shape): number',
      activeParameter: 'shape: Shape',
      documentation: 'the shape',
    });
    expect(
      signatureLines({
        items: [],
        selectedItem: 0,
        argumentIndex: 0,
        argumentCount: 0,
      }),
    ).toBeNull();
  });
});

describe('a diagnostics refresh without an edit (F10: /repl re-opened with new compiler options)', () => {
  const updateOf = (...transactions: ReturnType<EditorState['update']>[]) =>
    ({ transactions }) as unknown as ViewUpdate;

  it('asks the linter to run again for the refresh effect and for nothing else without a change', () => {
    const state = EditorState.create({ doc: 'const n = 1;\n' });
    expect(
      needsDiagnosticsRefresh(
        updateOf(state.update({ effects: refreshDiagnostics.of(null) })),
      ),
    ).toBe(true);
    expect(
      needsDiagnosticsRefresh(
        updateOf(state.update({ selection: { anchor: 3 } })),
      ),
    ).toBe(false);
    expect(needsDiagnosticsRefresh(updateOf())).toBe(false);
  });
});

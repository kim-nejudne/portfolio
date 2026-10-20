// The output pane's Tests tab (§4 Running and the output pane, §5 Verdict): the verdict line,
// then the four groups with a check or a cross and their findings under them. Presentational:
// the rows, the selection and the keys belong to the output pane (src/app/output-pane.tsx),
// what each row says to src/verify/tests-view.ts. A pass shows "Passed" and the `:next` hint;
// no sound, no confetti (§5).
import { cn } from 'cn';
import type { GroupStatus, TestsRow, VerdictLine } from '@/verify/tests-view';
import type { TestStatus } from '@/protocol/sandbox';

const GROUP_ICON: Record<GroupStatus, string> = {
  pass: '✓',
  fail: '✗',
  running: '…',
  'not-run': '–',
  pending: '·',
};

const TEST_ICON: Record<TestStatus, string> = {
  pass: '✓',
  fail: '✗',
  timeout: '✗',
  skip: '–',
};

const location = (file: string, line: number, column?: number): string =>
  column === undefined
    ? `${file.slice(1)}:${String(line)}`
    : `${file.slice(1)}:${String(line)}:${String(column)}`;

function RowBody({ row }: { row: TestsRow }) {
  switch (row.kind) {
    case 'group':
      return (
        <>
          <span aria-hidden className="w-3 shrink-0 text-center">
            {GROUP_ICON[row.status]}
          </span>
          <span className="font-semibold" data-field="label">
            {row.label}
          </span>
          <span className="text-muted-foreground" data-field="summary">
            {row.summary}
          </span>
        </>
      );
    case 'diagnostic':
      return (
        <span className="min-w-0 break-words">
          <span className="text-muted-foreground" data-field="loc">
            {location(row.diag.file, row.diag.line, row.diag.column)}
          </span>{' '}
          <span data-field="message">{row.diag.message}</span>{' '}
          <span className="text-muted-foreground">
            TS{String(row.diag.code)}
          </span>
        </span>
      );
    case 'case':
      return (
        <>
          <span aria-hidden className="w-3 shrink-0 text-center">
            {row.typeCase.ok ? '✓' : '✗'}
          </span>
          <span data-field="name">{row.typeCase.name}</span>
        </>
      );
    case 'test': {
      const { test } = row;
      return (
        <>
          <span aria-hidden className="w-3 shrink-0 text-center">
            {TEST_ICON[test.status]}
          </span>
          <span className="min-w-0 flex-1 break-words">
            <span data-field="name">{test.name}</span>
            {test.status !== 'pass' && (
              <span className="ml-2 text-muted-foreground" data-field="status">
                {test.status}
              </span>
            )}
            {test.message !== undefined && (
              <span className="block" data-field="message">
                {test.message}
              </span>
            )}
            {test.expected !== undefined && (
              <span className="block" data-field="expected">
                expected: {test.expected}
              </span>
            )}
            {test.actual !== undefined && (
              <span className="block" data-field="actual">
                actual: {test.actual}
              </span>
            )}
          </span>
          <span className="shrink-0 text-muted-foreground" data-field="ms">
            {String(Math.round(test.ms))} ms
          </span>
        </>
      );
    }
    case 'hit':
      return (
        <span className="min-w-0 break-words">
          <span className="text-muted-foreground" data-field="loc">
            {location(row.hit.file, row.hit.line)}
          </span>{' '}
          <span data-field="rule">{row.hit.rule}</span>{' '}
          <span data-field="message">{row.hit.message}</span>
        </span>
      );
  }
}

function rowStatus(row: TestsRow): string | undefined {
  switch (row.kind) {
    case 'group':
      return row.status;
    case 'case':
      return row.typeCase.ok ? 'pass' : 'fail';
    case 'test':
      return row.test.status;
    default:
      return undefined;
  }
}

function indent(row: TestsRow): string {
  if (row.kind === 'group') return '';
  if (row.kind === 'diagnostic' && row.depth === 2) return 'pl-10';
  return 'pl-5';
}

export interface TestsTabProps {
  rows: readonly TestsRow[];
  /** Index into `rows`, -1 for none. */
  selected: number;
  /** Whether the selection is shown: the Tests tab is the pane's current tab. */
  active: boolean;
  verdict: VerdictLine;
}

export function TestsTab({ rows, selected, active, verdict }: TestsTabProps) {
  return (
    <div>
      <p
        data-testid="verdict"
        data-verdict={verdict.kind}
        className={cn(
          'mb-1 px-1',
          verdict.kind === 'passed' && 'font-semibold',
          (verdict.kind === 'failed' || verdict.kind === 'error') &&
            'text-destructive',
          (verdict.kind === 'idle' || verdict.kind === 'running') &&
            'text-muted-foreground',
        )}
      >
        {verdict.text}
      </p>
      <ul data-testid="tests" aria-label="Tests">
        {rows.map((row, i) => {
          const isSelected = active && i === selected;
          return (
            <li
              key={row.key}
              data-row={row.kind}
              data-group={row.kind === 'group' ? row.group : undefined}
              data-expanded={
                row.kind === 'group' ? String(row.expanded) : undefined
              }
              data-status={rowStatus(row)}
              data-selected={isSelected ? 'true' : undefined}
              className={cn(
                'flex gap-2 rounded px-1 whitespace-pre-wrap',
                indent(row),
                isSelected && 'bg-accent',
                row.kind === 'group' &&
                  row.status === 'fail' &&
                  'text-destructive',
                row.kind === 'test' &&
                  (row.test.status === 'fail' ||
                    row.test.status === 'timeout') &&
                  'text-destructive',
              )}
            >
              <RowBody row={row} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

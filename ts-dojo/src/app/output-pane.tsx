// The output pane (§4 Running and the output pane): Console, Problems and Tests tabs and the
// status line. It is one of the three §4 focus targets, so it takes focus and its own keys:
// `j`/`k` move, `Enter` jumps to the entry's TypeScript position, `h`/`l` switch tabs, `Esc`
// returns to the editor. The run state comes from the sandbox runner, the diagnostics from the
// editor. The Tests tab (F7, §5 Verdict) shows the four groups of the last `:test`: `j`/`k`
// move over the rows, `Enter` on a group expands or collapses it, on a diagnostic, a rule hit,
// a failed case or a failed test moves the cursor there; the status line follows the test run
// while that tab is shown.
import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { cn } from 'cn';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SourceLoc } from '@/protocol/sandbox';
import type { Diag } from '@/protocol/ts-ls';
import type { GroupName } from '@/verify/exercise';
import {
  buildRows,
  jumpTarget,
  verdictLine,
  type TestsRow,
} from '@/verify/tests-view';
import { IDLE_VERIFIER, type VerifierState } from '@/verify/verifier';
import type { RunState } from '@/workers/sandbox/runner';
import { entryText, locOf, locText } from './output-entry';
import { formatStatus } from './run-status';
import { TestsTab } from './tests-tab';

export type OutputTab = 'console' | 'problems' | 'tests';
export const OUTPUT_TABS: readonly OutputTab[] = [
  'console',
  'problems',
  'tests',
];

/** What the Tests tab shows: a lesson page's verification (`:test`); absent on /repl. */
export interface OutputTests {
  verifier: VerifierState;
  /** The `mode: 'test'` run: its streamed results and its status line. */
  run: RunState;
  /** A runtime test's `test('name'` line in tests.ts, for `Enter`. */
  locateTest: (name: string) => SourceLoc | null;
}

const NO_TOGGLES: ReadonlyMap<GroupName, boolean> = new Map();

export interface OutputPaneProps {
  ref: Ref<HTMLElement>;
  state: RunState;
  diagnostics: Diag[];
  tab: OutputTab;
  onTabChange: (tab: OutputTab) => void;
  onJump: (loc: SourceLoc) => void;
  onEscape: () => void;
  tests?: OutputTests;
  className?: string;
}

export function OutputPane({
  ref,
  state,
  diagnostics,
  tab,
  onTabChange,
  onJump,
  onEscape,
  tests,
  className,
}: OutputPaneProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const verifier = tests?.verifier ?? IDLE_VERIFIER;
  // The groups toggled with `Enter` belong to one `:test`; the next one starts from the defaults.
  const [toggles, setToggles] = useState({
    run: verifier.run,
    map: NO_TOGGLES,
  });
  const overrides = toggles.run === verifier.run ? toggles.map : NO_TOGGLES;
  const liveTests = tests?.run.tests;
  const rows = useMemo<TestsRow[]>(
    () => buildRows(verifier, liveTests ?? [], overrides),
    [verifier, liveTests, overrides],
  );
  // The selection belongs to one tab of one run; a change of either starts at the top again.
  const key = `${tab}:${String(tab === 'tests' ? verifier.run : state.run)}`;
  const [selection, setSelection] = useState({ key, index: 0 });
  const index = selection.key === key ? selection.index : 0;
  const count =
    tab === 'console'
      ? state.entries.length
      : tab === 'problems'
        ? diagnostics.length
        : rows.length;
  const selected = count === 0 ? -1 : Math.min(index, count - 1);

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected, tab]);

  const move = (delta: number): void => {
    if (count === 0) return;
    setSelection({
      key,
      index: Math.max(0, Math.min(count - 1, selected + delta)),
    });
  };
  const jump = (): void => {
    if (selected < 0) return;
    if (tab === 'console') {
      const entry = state.entries[selected];
      const loc = entry === undefined ? null : locOf(entry);
      if (loc !== null) onJump(loc);
    } else if (tab === 'problems') {
      const diag = diagnostics[selected];
      if (diag !== undefined) {
        onJump({ file: diag.file, line: diag.line, column: diag.column });
      }
    } else {
      const row = rows[selected];
      if (row === undefined) return;
      if (row.kind === 'group') {
        const map = new Map(overrides);
        map.set(row.group, !row.expanded);
        setToggles({ run: verifier.run, map });
        return;
      }
      const loc = jumpTarget(row, (name) => tests?.locateTest(name) ?? null);
      if (loc !== null) onJump(loc);
    }
  };
  const switchTab = (delta: number): void => {
    const at = OUTPUT_TABS.indexOf(tab);
    const next =
      OUTPUT_TABS[(at + delta + OUTPUT_TABS.length) % OUTPUT_TABS.length];
    if (next !== undefined) onTabChange(next);
  };
  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    switch (event.key) {
      case 'j':
        move(1);
        break;
      case 'k':
        move(-1);
        break;
      case 'Enter':
        jump();
        break;
      case 'h':
        switchTab(-1);
        break;
      case 'l':
        switchTab(1);
        break;
      case 'Escape':
        onEscape();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  // The status line follows the test run while the Tests tab is shown.
  const shown = tab === 'tests' && tests !== undefined ? tests.run : state;
  const status = formatStatus(shown.status);
  return (
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
    <section
      ref={ref}
      tabIndex={0}
      data-pane="output"
      aria-label="Output"
      onKeyDown={onKeyDown}
      className={cn(
        'flex min-h-0 flex-col border-t font-mono text-xs outline-none focus:ring-1 focus:ring-ring focus:ring-inset',
        className,
      )}
    >
      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as OutputTab)}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="flex h-7 shrink-0 items-center gap-3 border-b bg-muted px-2">
          <TabsList variant="line" className="h-full">
            <TabsTrigger value="console" tabIndex={-1} className="text-xs">
              Console
              {state.entries.length > 0 && ` (${String(state.entries.length)})`}
            </TabsTrigger>
            <TabsTrigger value="problems" tabIndex={-1} className="text-xs">
              Problems ({diagnostics.length})
            </TabsTrigger>
            <TabsTrigger value="tests" tabIndex={-1} className="text-xs">
              Tests
              {verifier.status === 'done' &&
                (verifier.result?.passed === true ? ' ✓' : ' ✗')}
            </TabsTrigger>
          </TabsList>
          <span
            role="status"
            aria-label="run status"
            data-status={shown.status.kind}
            className={cn(
              'ml-auto',
              shown.status.kind === 'killed' || shown.status.kind === 'failed'
                ? 'text-destructive'
                : 'text-muted-foreground',
            )}
          >
            {status}
            {shown.format === 'cjs' && (
              <span className="ml-2 text-muted-foreground">
                (CommonJS: cyclic imports)
              </span>
            )}
          </span>
        </div>
        <div ref={listRef} className="min-h-0 flex-1 overflow-auto px-2 py-1">
          <TabsContent value="console" keepMounted>
            <ul data-testid="console" aria-label="Console">
              {state.entries.map((entry, i) => (
                <li
                  key={String(i)}
                  data-kind={entry.kind}
                  data-level={
                    entry.kind === 'console' ? entry.level : undefined
                  }
                  data-selected={
                    tab === 'console' && i === selected ? 'true' : undefined
                  }
                  className={cn(
                    'flex gap-3 px-1 whitespace-pre-wrap',
                    tab === 'console' && i === selected && 'bg-selection',
                    entry.kind === 'error' && 'text-destructive',
                    entry.kind === 'console' &&
                      entry.level === 'warn' &&
                      'text-warning',
                    entry.kind === 'console' &&
                      entry.level === 'error' &&
                      'text-destructive',
                    entry.kind === 'truncated' &&
                      'text-muted-foreground italic',
                  )}
                >
                  <span className="min-w-0 flex-1 break-words">
                    {entryText(entry)}
                  </span>
                  <span className="shrink-0 text-muted-foreground" data-loc>
                    {locText(locOf(entry))}
                  </span>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="problems" keepMounted>
            <ul data-testid="problems" aria-label="Problems">
              {diagnostics.map((d, i) => (
                <li
                  key={`${d.file}:${String(d.start)}:${String(i)}`}
                  data-selected={
                    tab === 'problems' && i === selected ? 'true' : undefined
                  }
                  className={cn(
                    ' px-1',
                    tab === 'problems' && i === selected && 'bg-selection',
                  )}
                >
                  <span className="text-muted-foreground">
                    {d.file.slice(1)}:{d.line}:{d.column}
                  </span>{' '}
                  {d.message}{' '}
                  <span className="text-muted-foreground">TS{d.code}</span>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="tests" keepMounted>
            {tests === undefined ? (
              <p className="text-muted-foreground">
                :test checks an exercise on its lesson page.
              </p>
            ) : (
              <TestsTab
                rows={rows}
                selected={selected}
                active={tab === 'tests'}
                verdict={verdictLine(verifier)}
              />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </section>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  );
}

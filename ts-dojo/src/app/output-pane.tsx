// The output pane (§4 Running and the output pane): Console, Problems and Tests tabs and the
// status line. It is one of the three §4 focus targets, so it takes focus and its own keys:
// `j`/`k` move, `Enter` jumps to the entry's TypeScript position, `h`/`l` switch tabs, `Esc`
// returns to the editor. The Tests tab fills at F7; the run state comes from the sandbox
// runner, the diagnostics from the editor.
import { useEffect, useRef, useState, type Ref } from 'react';
import { cn } from 'cn';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SourceLoc } from '@/protocol/sandbox';
import type { Diag } from '@/protocol/ts-ls';
import type { OutputEntry, RunState } from '@/workers/sandbox/runner';
import { formatStatus } from './run-status';

export type OutputTab = 'console' | 'problems' | 'tests';
export const OUTPUT_TABS: readonly OutputTab[] = [
  'console',
  'problems',
  'tests',
];

export interface OutputPaneProps {
  ref: Ref<HTMLElement>;
  state: RunState;
  diagnostics: Diag[];
  tab: OutputTab;
  onTabChange: (tab: OutputTab) => void;
  onJump: (loc: SourceLoc) => void;
  onEscape: () => void;
  className?: string;
}

function locOf(entry: OutputEntry): SourceLoc | null {
  return entry.kind === 'truncated' ? null : entry.loc;
}

function locText(loc: SourceLoc | null): string {
  return loc === null ? '' : `${loc.file.slice(1)}:${String(loc.line)}`;
}

function entryText(entry: OutputEntry): string {
  switch (entry.kind) {
    case 'console':
      return entry.text;
    case 'error':
      return entry.message;
    case 'truncated':
      return `output truncated after ${String(entry.entries)} entries (${String(Math.round(entry.bytes / 1000))} KB)`;
  }
}

export function OutputPane({
  ref,
  state,
  diagnostics,
  tab,
  onTabChange,
  onJump,
  onEscape,
  className,
}: OutputPaneProps) {
  const listRef = useRef<HTMLDivElement>(null);
  // The selection belongs to one tab of one run; a change of either starts at the top again.
  const key = `${tab}:${String(state.run)}`;
  const [selection, setSelection] = useState({ key, index: 0 });
  const index = selection.key === key ? selection.index : 0;
  const count =
    tab === 'console'
      ? state.entries.length
      : tab === 'problems'
        ? diagnostics.length
        : 0;
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

  const status = formatStatus(state.status);
  return (
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
    <section
      ref={ref}
      tabIndex={0}
      data-pane="output"
      aria-label="Output"
      onKeyDown={onKeyDown}
      className={cn(
        'flex min-h-0 flex-col border-t font-mono text-xs outline-none focus:ring-2 focus:ring-ring focus:ring-inset',
        className,
      )}
    >
      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as OutputTab)}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="flex shrink-0 items-center gap-3 border-b px-2 py-1">
          <TabsList variant="line" className="h-6">
            <TabsTrigger value="console" tabIndex={-1} className="text-xs">
              Console
              {state.entries.length > 0 && ` (${String(state.entries.length)})`}
            </TabsTrigger>
            <TabsTrigger value="problems" tabIndex={-1} className="text-xs">
              Problems ({diagnostics.length})
            </TabsTrigger>
            <TabsTrigger value="tests" tabIndex={-1} className="text-xs">
              Tests
            </TabsTrigger>
          </TabsList>
          <span
            role="status"
            aria-label="run status"
            data-status={state.status.kind}
            className={cn(
              'ml-auto',
              state.status.kind === 'killed' || state.status.kind === 'failed'
                ? 'text-destructive'
                : 'text-muted-foreground',
            )}
          >
            {status}
            {state.format === 'cjs' && (
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
                    'flex gap-3 rounded px-1 whitespace-pre-wrap',
                    tab === 'console' && i === selected && 'bg-accent',
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
                    'rounded px-1',
                    tab === 'problems' && i === selected && 'bg-accent',
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
            <p className="text-muted-foreground">
              Runtime tests and the verdict appear here after :test (F7).
            </p>
          </TabsContent>
        </div>
      </Tabs>
    </section>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  );
}

// A theory code block (spec §3 lesson.mdx, §1 Examples): the HTML shiki rendered at build
// time, and for `ts run` and `ts run errors` the Run and Open in REPL buttons. Run hands the
// snippet's pre-emitted JavaScript to a fresh sandbox worker (no compiler round trip, works
// before the compiler is ready) and shows the output under the block; `run errors` shows the
// diagnostics the build computed with the app's own core. Open in REPL is F5's action: a new
// buffer named after the lesson with the snippet, then `/repl`. The block itself takes focus
// and `Enter` on it runs Open in REPL (§6 theory keys, F8); the buttons are real buttons too.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useAppActions } from '@/app/app-actions';
import { entryText, locText } from '@/app/output-entry';
import { formatStatus } from '@/app/run-status';
import { createAppSandboxRunner } from '@/app/sandbox';
import { Button } from '@/components/ui/button';
import type { Diag } from '@/protocol/ts-ls';
import { browserStorage, readSettings, timeoutFor } from '@/store/settings';
import type { SandboxRunner } from '@/workers/sandbox/runner';
import { SNIPPET_PATH, type FenceKind } from '../fences';
import { useLessonContext } from './lesson-context';

export interface CodeBlockElementProps {
  kind: Exclude<FenceKind, 'other'>;
  code: string;
  html: string;
  /** The emitted JavaScript, for `run` and `run-errors`. */
  js?: string;
  /** JSON `Diag[]`, for `run-errors`. */
  diagnostics?: string;
}

function parseDiagnostics(json: string | undefined): Diag[] {
  if (json === undefined) return [];
  try {
    return JSON.parse(json) as Diag[];
  } catch {
    return [];
  }
}

/** The snippet's output: entries and the status line of its own runner. */
function BlockOutput({ runner }: { runner: SandboxRunner }) {
  const state = useSyncExternalStore(
    runner.subscribe,
    () => runner.state,
    () => runner.state,
  );
  if (state.status.kind === 'idle') return null;
  return (
    <div
      className="code-block-output rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs"
      role="region"
      aria-label="Output"
    >
      <ul className="m-0 list-none p-0">
        {state.entries.map((entry, index) => (
          <li
            key={index}
            className={
              entry.kind === 'error'
                ? 'whitespace-pre-wrap text-destructive'
                : 'whitespace-pre-wrap'
            }
          >
            {entryText(entry)}
            {entry.kind !== 'truncated' && entry.loc !== null ? (
              <span className="ml-2 text-muted-foreground">
                {locText(entry.loc)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="m-0 mt-1 text-muted-foreground" role="status">
        {formatStatus(state.status)}
      </p>
    </div>
  );
}

export function CodeBlock({
  kind,
  code,
  html,
  js,
  diagnostics,
}: CodeBlockElementProps) {
  const actions = useAppActions();
  const lesson = useLessonContext();
  const runnable = kind === 'run' || kind === 'run-errors';
  const [runner, setRunner] = useState<SandboxRunner | null>(null);
  useEffect(() => () => runner?.dispose(), [runner]);
  const diags = useMemo(() => parseDiagnostics(diagnostics), [diagnostics]);

  const run = (): void => {
    if (js === undefined) return;
    const active = runner ?? createAppSandboxRunner();
    if (active !== runner) setRunner(active);
    void active.start([{ path: SNIPPET_PATH, js, imports: [] }], SNIPPET_PATH, {
      // F10: the Settings default timeout, read at each run.
      timeoutMs: timeoutFor(null, readSettings(browserStorage())),
    });
  };
  const openInRepl = (): void => {
    void actions.openInRepl(
      lesson === null
        ? { snippet: code }
        : { snippet: code, name: lesson.folder },
    );
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.target !== event.currentTarget || event.key !== 'Enter') return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    openInRepl();
  };

  return (
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- a focused block opens in the REPL with Enter (§6) */
    <div
      className="code-block rounded-md outline-none focus:ring-2 focus:ring-ring"
      data-kind={kind}
      tabIndex={0}
      role="group"
      aria-label="Code example: Enter opens it in the REPL"
      onKeyDown={onKeyDown}
    >
      <div
        className="twoslash-host"
        // Build-time output of shiki and twoslash over the lesson's own source (§3).
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {runnable ? (
        <div className="mt-1 flex items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={run}>
            Run
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={openInRepl}>
            Open in REPL
          </Button>
        </div>
      ) : null}
      {kind === 'run-errors' && diags.length > 0 ? (
        <ul
          className="code-block-diagnostics m-0 mt-1 list-none rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-xs"
          aria-label="Diagnostics"
        >
          {diags.map((diag, index) => (
            <li key={index} className="whitespace-pre-wrap">
              <span className="text-muted-foreground">
                line {diag.line}, TS{diag.code}:{' '}
              </span>
              {diag.message}
            </li>
          ))}
        </ul>
      ) : null}
      {runner !== null ? <BlockOutput runner={runner} /> : null}
    </div>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  );
}

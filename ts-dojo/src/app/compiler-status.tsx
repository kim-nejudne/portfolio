// The compiler status chip in the header (§4: "a status chip says 'compiler loading' until
// ready"; §6 Theme and type: the one-line header carries it; §9 Staleness and failure: a
// restart shows for 5 s). It is a live region so Playwright and screen readers can wait on it.
import { useEffect, useState } from 'react';
import { cn } from 'cn';
import type { CompilerStatus } from '@/workers/ts-ls/client';
import { useCompilerStatus } from './compiler';

export const RESTART_NOTICE_MS = 5000;

export function compilerStatusText(
  status: CompilerStatus,
  showRestarted: boolean,
): string {
  switch (status.state) {
    case 'loading':
      return 'compiler loading';
    case 'restarting':
      return 'compiler restarting';
    case 'failed':
      return 'compiler failed';
    case 'ready':
      return showRestarted
        ? 'compiler restarted'
        : `TypeScript ${status.tsVersion}`;
  }
}

export function CompilerStatusChip() {
  const status = useCompilerStatus();
  // The restart notice is dismissed per restart count, after RESTART_NOTICE_MS.
  const [noticeDismissedFor, setNoticeDismissedFor] = useState(0);
  const showRestarted =
    status.state === 'ready' &&
    status.restarts > 0 &&
    noticeDismissedFor < status.restarts;
  const { restarts } = status;
  useEffect(() => {
    if (!showRestarted) return;
    const timer = setTimeout(() => {
      setNoticeDismissedFor(restarts);
    }, RESTART_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [showRestarted, restarts]);
  return (
    <span
      role="status"
      aria-label="compiler status"
      data-state={status.state}
      className={cn(
        'border px-1.5 py-0.5 font-mono text-xs text-muted-foreground',
        status.state === 'failed' && 'border-destructive text-destructive',
        status.state === 'ready' && !showRestarted && 'text-success',
      )}
    >
      {compilerStatusText(status, showRestarted)}
    </span>
  );
}

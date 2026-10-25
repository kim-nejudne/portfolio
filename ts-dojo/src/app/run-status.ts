// The output pane's status line (§4 Running and the output pane: "running, done in N ms,
// killed after N ms"; §12 F4: "killed after 5 s", "still running (1 timer)"). Pure text so the
// pane and the tests share one source.
import type { RunStatus } from '@/workers/sandbox/runner';

/** `412 ms`, `5 s`, `1.3 s`. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${String(Math.round(ms))} ms`;
  const seconds = Math.round(ms / 100) / 10;
  return `${String(seconds)} s`;
}

export function formatStatus(status: RunStatus): string {
  switch (status.kind) {
    case 'idle':
      return '';
    case 'preparing':
    case 'running':
      return 'running';
    case 'still-running':
      return `still running (${String(status.pendingTimers)} timer${status.pendingTimers === 1 ? '' : 's'})`;
    case 'done':
      return `done in ${formatDuration(status.durationMs)}`;
    case 'killed':
      return `killed after ${formatDuration(status.afterMs)}`;
    case 'failed':
      return `failed: ${status.message}`;
  }
}

// One output entry as text (§4 Running and the output pane): what the output pane's Console
// tab and a theory block's output (src/content/components/code-block.tsx) both show.
import type { SourceLoc } from '@/protocol/sandbox';
import type { OutputEntry } from '@/workers/sandbox/runner';

export function locOf(entry: OutputEntry): SourceLoc | null {
  return entry.kind === 'truncated' ? null : entry.loc;
}

export function locText(loc: SourceLoc | null): string {
  return loc === null ? '' : `${loc.file.slice(1)}:${String(loc.line)}`;
}

export function entryText(entry: OutputEntry): string {
  switch (entry.kind) {
    case 'console':
      return entry.text;
    case 'error':
      return entry.message;
    case 'truncated':
      return `output truncated after ${String(entry.entries)} entries (${String(Math.round(entry.bytes / 1000))} KB)`;
  }
}

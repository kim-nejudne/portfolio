// What the spike page exposes on window for the Playwright checklist (spike/vim/checklist.spec.ts).
import type { EditorView } from '@codemirror/view';
import type { CodeMirror, Vim } from '@replit/codemirror-vim';

export interface SpikeWorkarounds {
  foldKeys(): void;
  setOptions(): void;
  starRegister(): void;
  insertCtrlH(): void;
  insertCtrlHViaVimMap(): void;
  clipboardPaste(): void;
  leaderKey(): void;
  lineUndo(): void;
  writeEx(): void;
}

export interface Spike {
  view: EditorView;
  cm: CodeMirror;
  Vim: Vim;
  workarounds: SpikeWorkarounds;
  /** How many times the `:w` defined by workarounds.writeEx ran. */
  writes: number;
  foldCount(): number;
  gutterNumbers(): string[];
}

declare global {
  interface Window {
    __spike: Spike;
  }
}

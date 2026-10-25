// A line in the Vim status panel, the way the engine reports "Not an editor command": the app's
// own messages (`:ls`, "no file named x", a vimrc error, a command another feature owns) go
// through the same notification so they appear where Kim is looking. `role="status"` lets a
// test (and a screen reader) read it.
import type { EditorView } from '@codemirror/view';
import { getCM, type CodeMirror } from '@replit/codemirror-vim';

export const NOTIFY_DURATION_MS = 5000;

export function notifyCm(
  cm: CodeMirror | null,
  text: string,
  duration = NOTIFY_DURATION_MS,
): void {
  if (cm === null) return;
  const dom = document.createElement('div');
  dom.className = 'cm-vim-message cm-dojo-notice';
  dom.setAttribute('role', 'status');
  dom.style.whiteSpace = 'pre';
  dom.textContent = text;
  cm.openNotification(dom, { bottom: true, duration });
}

export function notify(
  view: EditorView,
  text: string,
  duration = NOTIFY_DURATION_MS,
): void {
  notifyCm(getCM(view), text, duration);
}

// A yes/no question in the Vim panel (spec §4: `:bd` deletes a scratch buffer "after a
// confirmation"; §4 "the editor's `:` line is the app's command line"). The same adapter
// dialog the engine uses for `:s///c` ("replace with … (y/n/a/q/l)"): a prefix, an input that
// takes the one key, and `onKeyDown` deciding. `y` answers yes; `n`, `Esc`, `Enter` and a lost
// focus answer no. Never `window.confirm`, which would block the page and every test.
import type { CodeMirror } from '@replit/codemirror-vim';

export interface ConfirmHost {
  openDialog: CodeMirror['openDialog'];
}

/** Resolves true on `y`, false on anything that closes the prompt. */
export function confirmInPanel(
  cm: ConfirmHost,
  question: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (answer: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(answer);
    };

    const template = document.createElement('div');
    template.style.display = 'flex';
    template.style.flex = '1';
    const prefix = document.createElement('span');
    prefix.className = 'cm-dojo-confirm';
    prefix.setAttribute('role', 'alertdialog');
    prefix.style.fontFamily = 'monospace';
    prefix.style.whiteSpace = 'pre';
    prefix.style.flex = '1';
    prefix.style.display = 'flex';
    prefix.textContent = `${question} (y/n)`;
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.spellcheck = false;
    input.setAttribute('aria-label', question);
    input.style.flex = '1';
    prefix.appendChild(input);
    template.appendChild(prefix);

    cm.openDialog(template, undefined, {
      bottom: true,
      selectValueOnOpen: false,
      onKeyDown: (event: KeyboardEvent, _value: string, close: () => void) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'y' || event.key === 'Y') {
          settle(true);
          close();
        } else if (
          event.key === 'n' ||
          event.key === 'N' ||
          event.key === 'Escape' ||
          event.key === 'Enter'
        ) {
          settle(false);
          close();
        }
        return true;
      },
      onClose: () => settle(false),
    });
  });
}

// Signature help on `(` and `,` (§4 Type feedback): typing either in insert mode asks ts-ls for
// the signatures at the cursor and shows them in a tooltip with the active parameter marked;
// later typing refreshes it while it is open, `)` or a cursor move without an edit closes it,
// and so does a reply with nothing to show.
import { StateEffect, StateField, type Extension } from '@codemirror/state';
import { EditorView, showTooltip, type Tooltip } from '@codemirror/view';
import type { SignatureHelpResult } from '@/protocol/ts-ls';
import type { TsLsClient } from '@/workers/ts-ls/client';
import { filePath } from './file-path';

const setSignature = StateEffect.define<Tooltip | null>();

export const signatureField = StateField.define<Tooltip | null>({
  create: () => null,
  update(value, tr) {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(setSignature)) next = effect.value;
    }
    if (next === value && !tr.docChanged && tr.selection !== undefined) {
      return null;
    }
    return next;
  },
  provide: (field) => showTooltip.from(field),
});

export interface SignatureLines {
  label: string;
  activeParameter: string | null;
  documentation: string;
}

/** The selected signature with its active parameter, as the tooltip prints it. */
export function signatureLines(
  help: SignatureHelpResult,
): SignatureLines | null {
  const item = help.items[help.selectedItem] ?? help.items[0];
  if (item === undefined) return null;
  const active = item.parameters[help.argumentIndex];
  return {
    label: item.label,
    activeParameter: active?.label ?? null,
    documentation: (active?.documentation ?? item.documentation).trim(),
  };
}

function render(help: SignatureHelpResult): HTMLElement | null {
  const lines = signatureLines(help);
  if (lines === null) return null;
  const dom = document.createElement('div');
  dom.className = 'cm-dojo-signature';
  dom.setAttribute('data-testid', 'signature-help');
  const label = document.createElement('div');
  label.className = 'cm-dojo-signature-label';
  if (lines.activeParameter !== null) {
    const at = lines.label.indexOf(lines.activeParameter);
    if (at >= 0) {
      const strong = document.createElement('strong');
      strong.textContent = lines.activeParameter;
      label.append(
        lines.label.slice(0, at),
        strong,
        lines.label.slice(at + lines.activeParameter.length),
      );
    } else {
      label.textContent = lines.label;
    }
  } else {
    label.textContent = lines.label;
  }
  dom.append(label);
  if (lines.documentation !== '') {
    const docs = document.createElement('div');
    docs.className = 'cm-dojo-signature-docs';
    docs.textContent = lines.documentation;
    dom.append(docs);
  }
  return dom;
}

type SignatureClient = Pick<TsLsClient, 'getSignatureHelp'>;

/** The characters that open the tooltip when typed. */
export const SIGNATURE_TRIGGERS = new Set(['(', ',']);

export function signatureHelp(compiler: SignatureClient): Extension {
  const request = (view: EditorView): void => {
    const path = view.state.facet(filePath);
    const pos = view.state.selection.main.head;
    compiler
      .getSignatureHelp(path, pos)
      .then((help) => {
        if (view.state.selection.main.head !== pos) return;
        const dom = help === null ? null : render(help);
        view.dispatch({
          effects: setSignature.of(
            dom === null ? null : { pos, above: true, create: () => ({ dom }) },
          ),
        });
      })
      .catch(() => undefined);
  };
  const listener = EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    let typed = '';
    update.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
      typed += inserted.toString();
    });
    const open = update.state.field(signatureField) !== null;
    if (typed === ')') {
      if (open) update.view.dispatch({ effects: setSignature.of(null) });
      return;
    }
    if (SIGNATURE_TRIGGERS.has(typed) || (open && typed.length > 0)) {
      request(update.view);
    }
  });
  return [signatureField, listener, signatureTheme];
}

export const signatureTheme = EditorView.baseTheme({
  '.cm-tooltip.cm-dojo-signature': {
    padding: '4px 8px',
    fontSize: '0.9em',
    maxWidth: '40rem',
  },
  '.cm-dojo-signature-label': { whiteSpace: 'pre-wrap' },
  '.cm-dojo-signature-docs': {
    marginTop: '4px',
    fontFamily: 'var(--font-sans)',
    color: 'var(--muted-foreground)',
  },
});

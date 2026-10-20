// Completions (§4 Type feedback): the `@codemirror/autocomplete` source asks ts-ls on typing and
// on `Ctrl-Space`, details load when an item is selected. The keys are the spec's, not the
// package's default keymap: `Ctrl-j`/`Ctrl-k` and `Tab`/`Shift-Tab` move, `Ctrl-p` also moves
// up, `Enter` or `Ctrl-y` accept, `Esc` closes and returns to normal mode. They are a
// highest-precedence DOM handler so they run before the Vim plugin's own keydown; with no
// completion open every key falls through to Vim. `Ctrl-p` in normal mode opens the palette
// (§6: "from normal mode only; in insert mode it stays completion").
import {
  acceptCompletion,
  autocompletion,
  closeCompletion,
  completionStatus,
  moveCompletionSelection,
  startCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { Prec, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { getCM, Vim } from '@replit/codemirror-vim';
import type { CompletionEntry } from '@/protocol/ts-ls';
import type { TsLsClient } from '@/workers/ts-ls/client';
import { filePath } from './file-path';
import { renderInfo } from './quick-info';

/** TypeScript's ScriptElementKind names as CodeMirror completion types (its icon classes). */
const TYPES: Record<string, string> = {
  keyword: 'keyword',
  var: 'variable',
  let: 'variable',
  const: 'constant',
  'local var': 'variable',
  parameter: 'variable',
  property: 'property',
  getter: 'property',
  setter: 'property',
  method: 'method',
  function: 'function',
  'local function': 'function',
  class: 'class',
  'local class': 'class',
  interface: 'interface',
  type: 'type',
  'type parameter': 'type',
  enum: 'enum',
  'enum member': 'constant',
  module: 'namespace',
  alias: 'variable',
  'primitive type': 'type',
};

export function completionType(kind: string): string {
  return TYPES[kind] ?? 'text';
}

/** A ts-ls entry as a CodeMirror completion; TypeScript's sortText orders, lower first. */
export function toCompletion(
  entry: CompletionEntry,
  info?: Completion['info'],
): Completion {
  const completion: Completion = {
    label: entry.name,
    type: completionType(entry.kind),
    boost: -Number.parseInt(entry.sortText, 10) || 0,
  };
  if (entry.insertText !== undefined) completion.apply = entry.insertText;
  if (info !== undefined) completion.info = info;
  return completion;
}

/**
 * Whether a source should ask at this position: explicit (`Ctrl-Space`), a word being typed,
 * or right after a `.` (member completion has no word yet).
 */
export function shouldComplete(textBefore: string, explicit: boolean): boolean {
  if (explicit) return true;
  if (/[\w$]$/.test(textBefore)) return true;
  return textBefore.endsWith('.');
}

type CompletionClient = Pick<
  TsLsClient,
  'getCompletions' | 'getCompletionDetails'
>;

export function tsCompletionSource(compiler: CompletionClient) {
  return async (
    context: CompletionContext,
  ): Promise<CompletionResult | null> => {
    const cm = getCM(context.view ?? ({} as EditorView));
    if (cm !== null && cm.state.vim?.insertMode !== true) return null;
    const word = context.matchBefore(/[\w$]*/);
    const from = word?.from ?? context.pos;
    const line = context.state.doc.lineAt(context.pos);
    const before = context.state.sliceDoc(line.from, context.pos);
    if (!shouldComplete(before, context.explicit)) return null;
    const path = context.state.facet(filePath);
    let result;
    try {
      result = await compiler.getCompletions(path, context.pos);
    } catch {
      return null;
    }
    if (result === null) return null;
    const options = result.entries.map((entry) =>
      toCompletion(entry, async () => {
        try {
          const details = await compiler.getCompletionDetails(
            path,
            context.pos,
            entry.name,
          );
          return details === null ? null : renderInfo(details);
        } catch {
          return null;
        }
      }),
    );
    return { from, options, validFor: /^[\w$]*$/ };
  };
}

/** How long a just-opened completion list ignores keys (CodeMirror's default). */
export const COMPLETION_INTERACTION_DELAY_MS = 75;

export interface CompletionKeyOptions {
  /** `Ctrl-p` from normal mode. */
  openPalette: () => void;
}

function insertMode(view: EditorView): boolean {
  return getCM(view)?.state.vim?.insertMode === true;
}

/** The §4 completion keys, before Vim sees the event. */
export function completionKeys(options: CompletionKeyOptions): Extension {
  const handle = (event: KeyboardEvent, view: EditorView): boolean => {
    if (event.altKey || event.metaKey) return false;
    const active = completionStatus(view.state) === 'active';
    const ctrl = event.ctrlKey;
    const key = event.key;
    if (ctrl && key === ' ') {
      return insertMode(view) ? startCompletion(view) : false;
    }
    if (ctrl && key === 'p') {
      if (active) return moveCompletionSelection(false)(view);
      if (insertMode(view)) return startCompletion(view);
      options.openPalette();
      return true;
    }
    if (!active) return false;
    if (ctrl && key === 'j') return moveCompletionSelection(true)(view);
    if (ctrl && key === 'k') return moveCompletionSelection(false)(view);
    if (ctrl && key === 'y') return acceptCompletion(view);
    if (ctrl) return false;
    if (key === 'Tab') {
      return moveCompletionSelection(!event.shiftKey)(view);
    }
    if (key === 'Enter') return acceptCompletion(view);
    if (key === 'Escape') {
      closeCompletion(view);
      const cm = getCM(view);
      if (cm !== null) Vim.handleKey(cm, '<Esc>', 'user');
      return true;
    }
    return false;
  };
  return Prec.highest(
    EditorView.domEventHandlers({
      keydown: (event, view) => handle(event, view),
    }),
  );
}

export function completions(
  compiler: CompletionClient,
  keys: CompletionKeyOptions,
): Extension {
  return [
    autocompletion({
      override: [tsCompletionSource(compiler)],
      // CodeMirror's default, named: a list just opened ignores keys this long, so an Enter
      // typed as it appears is not taken as accepting it. The e2e helpers wait it out.
      interactionDelay: COMPLETION_INTERACTION_DELAY_MS,
      defaultKeymap: false,
      activateOnTyping: true,
      icons: false,
      closeOnBlur: true,
    }),
    completionKeys(keys),
  ];
}

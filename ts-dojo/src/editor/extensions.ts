// The CodeMirror setup (spec §2 Editor, §4): the Prep spike's extension list, which the §4
// checklist results assume (docs/prep-vim.md: `vim()` first, `allowMultipleSelections` for
// visual block, folds for `zo zc za zR zM`, `bracketMatching` for `%`, no `searchKeymap`),
// plus the F3 type feedback and the app theme (colours from the Tailwind tokens so light and
// dark follow `.dark` on <html>). `sharedExtensions` is built once per editor and reused by
// every file state; `fileExtensions` adds what differs per file.
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import {
  bracketMatching,
  codeFolding,
  foldGutter,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { highlightSelectionMatches } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { vim } from '@replit/codemirror-vim';
import { filePath } from './file-path';
import { optionExtensions } from './options';
import { insertCtrlH } from './vim-defaults';

/** Syntax colours as CSS variables (globals.css defines them for light and dark). */
export const dojoHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syntax-keyword)' },
  { tag: tags.controlKeyword, color: 'var(--syntax-keyword)' },
  { tag: tags.operatorKeyword, color: 'var(--syntax-keyword)' },
  { tag: tags.definitionKeyword, color: 'var(--syntax-keyword)' },
  { tag: tags.modifier, color: 'var(--syntax-keyword)' },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: 'var(--syntax-string)',
  },
  {
    tag: [tags.number, tags.bool, tags.null, tags.atom],
    color: 'var(--syntax-number)',
  },
  { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
  {
    tag: [tags.typeName, tags.className, tags.namespace],
    color: 'var(--syntax-type)',
  },
  {
    tag: [tags.propertyName, tags.attributeName],
    color: 'var(--syntax-property)',
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--syntax-function)',
  },
  { tag: tags.definition(tags.variableName), color: 'var(--syntax-variable)' },
  { tag: tags.variableName, color: 'var(--syntax-variable)' },
  {
    tag: [tags.operator, tags.punctuation, tags.bracket],
    color: 'var(--syntax-operator)',
  },
  { tag: tags.invalid, color: 'var(--destructive)' },
]);

export const dojoTheme = EditorView.theme({
  '&': {
    height: '100%',
    // §7 `fontSize` (F10): src/app/font-size.ts sets the property on <html>.
    fontSize: 'var(--code-font-size, 14px)',
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.55' },
  '.cm-content': { caretColor: 'var(--foreground)' },
  '.cm-gutters': {
    backgroundColor: 'var(--background)',
    color: 'var(--muted-foreground)',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--editor-active-line)' },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '3.5ch',
    paddingRight: '8px',
  },
  '&.cm-focused .cm-cursor, .cm-cursor': {
    borderLeftColor: 'var(--foreground)',
  },
  '.cm-fat-cursor, &:not(.cm-focused) .cm-fat-cursor': {
    background: 'var(--editor-cursor)',
    color: 'var(--background)',
    outline: 'none',
  },
  '&:not(.cm-focused) .cm-fat-cursor': {
    background: 'none',
    outline: '1px solid var(--editor-cursor)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection':
    { backgroundColor: 'var(--editor-selection) !important' },
  '.cm-selectionMatch': { backgroundColor: 'var(--editor-match)' },
  '.cm-searchMatch': { backgroundColor: 'var(--editor-match)' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'var(--editor-match)',
    outline: '1px solid var(--border)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
    borderTop: '1px solid var(--border)',
  },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--border)' },
  '.cm-vim-panel': {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    padding: '2px 8px',
    minHeight: '1.6em',
  },
  '.cm-vim-panel input': {
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
    outline: 'none',
    border: 'none',
  },
  '.cm-vim-message': { color: 'var(--foreground)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: '0',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--font-mono)',
    maxHeight: '16em',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    padding: '2px 8px',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--muted)',
    color: 'var(--foreground)',
  },
  '.cm-tooltip.cm-completionInfo': {
    padding: '0',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-tooltip-lint': { fontFamily: 'var(--font-mono)' },
  '.cm-diagnostic': { borderLeftWidth: '3px' },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--destructive)',
    textDecorationSkipInk: 'none',
    textUnderlineOffset: '3px',
  },
  '.cm-lint-marker-error': { color: 'var(--destructive)' },
  '.cm-foldGutter .cm-gutterElement': { cursor: 'pointer' },
});

/** Extensions every file state shares; `typeFeedback` is the F3 ts-ls wiring the controller builds. */
export function sharedExtensions(typeFeedback: Extension): Extension {
  return [
    vim({ status: true }), // "make sure vim is included before other keymaps" (package README)
    EditorState.allowMultipleSelections.of(true), // visual block is a multi-range selection
    optionExtensions(),
    history(),
    drawSelection(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    foldGutter(),
    codeFolding(),
    bracketMatching(),
    indentOnInput(),
    highlightSelectionMatches(),
    syntaxHighlighting(dojoHighlight),
    javascript({ typescript: true, jsx: true }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    insertCtrlH,
    typeFeedback,
    dojoTheme,
    EditorState.tabSize.of(2),
  ];
}

export interface FileExtensionOptions {
  path: string;
  readOnly: boolean;
  /** Called when an edit is refused in a read-only file. */
  onReadOnlyEdit: () => void;
}

/** What differs per file: its path for the TS extensions, and the read-only guard for a lesson `.d.ts`. */
export function fileExtensions(options: FileExtensionOptions): Extension {
  const own: Extension[] = [filePath.of(options.path)];
  if (options.readOnly) {
    own.push(
      EditorState.readOnly.of(true),
      EditorView.editorAttributes.of({ 'data-readonly': 'true' }),
      // Vim's edits do not consult `readOnly`, so every document change is dropped here.
      EditorState.transactionFilter.of((tr) => {
        if (!tr.docChanged) return tr;
        queueMicrotask(options.onReadOnlyEdit);
        return [];
      }),
    );
  }
  return own;
}

// The Prep Vim spike page (spec §11): one CodeMirror 6 editor with @replit/codemirror-vim,
// driven by spike/vim/checklist.spec.ts, plus a key log for the checks only Kim's real
// browser window can answer (§4 Browser-reserved keys). Not part of the app.
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import {
  bracketMatching,
  codeFolding,
  defaultHighlightStyle,
  foldGutter,
  foldedRanges,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { getCM, Vim, vim } from '@replit/codemirror-vim';
import type { Spike } from './types.ts';
import {
  compartments,
  foldKeys,
  insertCtrlH,
  insertCtrlHViaVimMap,
  clipboardPaste,
  leaderKey,
  lineUndo,
  setOptions,
  starRegister,
  writeEx,
} from './workarounds.ts';

const SAMPLE = `// ts-dojo Vim spike: edit freely, the checklist sets its own text.
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'square':
      return shape.side ** 2;
  }
}

const shapes: Shape[] = [
  { kind: 'circle', radius: 1 },
  { kind: 'square', side: 2 },
];

console.log(shapes.map(area));
`;

function must<T>(value: T | null): T {
  if (value === null) throw new Error('the spike page is missing an element');
  return value;
}

const view = new EditorView({
  state: EditorState.create({
    doc: SAMPLE,
    extensions: [
      vim({ status: true }), // "make sure vim is included before other keymaps" (package README)
      EditorState.allowMultipleSelections.of(true), // visual block mode is a multi-range selection; without this only one line is affected
      compartments.lineNumbers.of(lineNumbers()),
      compartments.wrap.of([]),
      compartments.insertKeys.of([]),
      history(),
      drawSelection(),
      highlightActiveLine(),
      foldGutter(),
      codeFolding(),
      bracketMatching(),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle),
      javascript({ typescript: true, jsx: true }),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.theme({
        '&': { height: '320px', fontSize: '14px' },
        '.cm-scroller': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          lineHeight: '20px',
        },
      }),
    ],
  }),
  parent: must(document.querySelector('#editor')),
});

const cm = must(getCM(view));

const spike: Spike = {
  view,
  cm,
  Vim,
  writes: 0,
  workarounds: {
    foldKeys,
    setOptions: () => setOptions(view),
    starRegister,
    insertCtrlH: () =>
      view.dispatch({
        effects: compartments.insertKeys.reconfigure(insertCtrlH),
      }),
    insertCtrlHViaVimMap,
    clipboardPaste,
    leaderKey: () => leaderKey('<Space>'),
    lineUndo,
    writeEx: () =>
      writeEx(() => {
        spike.writes += 1;
      }),
  },
  foldCount: () => {
    let count = 0;
    foldedRanges(view.state).between(0, view.state.doc.length, () => {
      count += 1;
    });
    return count;
  },
  gutterNumbers: () =>
    [...document.querySelectorAll('.cm-lineNumbers .cm-gutterElement')]
      .filter(
        (element) => (element as HTMLElement).style.visibility !== 'hidden',
      )
      .map((element) => element.textContent?.trim() ?? '')
      .filter((text) => text !== ''),
};
window.__spike = spike;

// Key log: every keydown that reaches the page, with whether something prevented its default.
const log = must(document.querySelector<HTMLOListElement>('#keylog'));
const prevent = must(document.querySelector<HTMLInputElement>('#prevent'));
must(document.querySelector<HTMLButtonElement>('#clear')).addEventListener(
  'click',
  () => {
    log.replaceChildren();
  },
);
window.addEventListener(
  'keydown',
  (event) => {
    if (prevent.checked && event.ctrlKey) event.preventDefault();
    const mods = [
      event.ctrlKey && 'Ctrl',
      event.altKey && 'Alt',
      event.shiftKey && 'Shift',
      event.metaKey && 'Meta',
    ]
      .filter(Boolean)
      .join('-');
    const item = document.createElement('li');
    item.textContent = `${mods ? `${mods}-` : ''}${event.key} (code ${event.code})`;
    log.prepend(item);
    queueMicrotask(() => {
      item.textContent += event.defaultPrevented
        ? ' · page prevented default'
        : ' · default not prevented';
    });
  },
  true,
);

view.focus();

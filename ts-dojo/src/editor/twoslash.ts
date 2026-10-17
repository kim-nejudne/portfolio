// `//   ^?` queries in the editor (§4 Type feedback): the answer renders as a block widget under
// the comment line, refreshed with every diagnostics cycle (diagnostics.ts dispatches
// `setTwoslashQueries`), and shows the worker's error text when the query points at nothing.
// Between cycles the widgets follow the document through `map`.
import { StateEffect, StateField, type Text } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view';
import type { TwoslashQuery } from '@/protocol/ts-ls';

export const setTwoslashQueries = StateEffect.define<TwoslashQuery[]>();

export interface TwoslashPlacement {
  /** The end of the comment line, where the block widget goes. */
  pos: number;
  text: string;
  error: boolean;
}

/** Where each query's widget goes; a query past the end of the document is dropped. */
export function placeTwoslash(
  doc: Text,
  queries: readonly TwoslashQuery[],
): TwoslashPlacement[] {
  const placements: TwoslashPlacement[] = [];
  for (const query of queries) {
    if (query.line < 1 || query.line > doc.lines) continue;
    const line = doc.line(query.line);
    if (query.error !== undefined) {
      placements.push({ pos: line.to, text: query.error, error: true });
    } else if (query.text !== undefined) {
      placements.push({ pos: line.to, text: query.text, error: false });
    }
  }
  return placements;
}

class TwoslashWidget extends WidgetType {
  readonly text: string;
  readonly error: boolean;
  constructor(text: string, error: boolean) {
    super();
    this.text = text;
    this.error = error;
  }
  override eq(other: TwoslashWidget): boolean {
    return other.text === this.text && other.error === this.error;
  }
  toDOM(): HTMLElement {
    const dom = document.createElement('div');
    dom.className = `cm-twoslash${this.error ? ' cm-twoslash-error' : ''}`;
    dom.setAttribute('data-testid', 'twoslash');
    dom.textContent = this.text;
    return dom;
  }
  override ignoreEvent(): boolean {
    return true;
  }
}

export function twoslashDecorations(
  doc: Text,
  queries: readonly TwoslashQuery[],
): DecorationSet {
  return Decoration.set(
    placeTwoslash(doc, queries).map((p) =>
      Decoration.widget({
        widget: new TwoslashWidget(p.text, p.error),
        block: true,
        side: 1,
      }).range(p.pos),
    ),
    true,
  );
}

export const twoslashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let next = value.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setTwoslashQueries)) {
        next = twoslashDecorations(tr.state.doc, effect.value);
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const twoslashTheme = EditorView.baseTheme({
  '.cm-twoslash': {
    fontFamily: 'inherit',
    fontSize: '0.92em',
    padding: '2px 8px 2px 1.5em',
    whiteSpace: 'pre-wrap',
    color: 'var(--muted-foreground)',
    borderLeft: '2px solid var(--border)',
    marginLeft: '2px',
  },
  '.cm-twoslash-error': {
    color: 'var(--destructive)',
  },
});

export function twoslash(): [typeof twoslashField, typeof twoslashTheme] {
  return [twoslashField, twoslashTheme];
}

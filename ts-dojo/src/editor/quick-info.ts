// Quick info (§4 Type feedback): the signature and the JSDoc of the symbol under the mouse
// (`hoverTooltip`) or under the cursor (`K`, through `:info`, as a tooltip the next edit or
// cursor move closes). One renderer for both and for the completion details.
import { StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  EditorView,
  hoverTooltip,
  showTooltip,
  type Tooltip,
} from '@codemirror/view';
import type { DocTag, QuickInfoResult } from '@/protocol/ts-ls';
import type { TsLsClient } from '@/workers/ts-ls/client';
import { filePath } from './file-path';

export interface InfoText {
  signature: string;
  documentation: string;
  tags: string[];
}

export function formatTag(tag: DocTag): string {
  return tag.text === '' ? `@${tag.name}` : `@${tag.name} ${tag.text}`;
}

/** The three parts a tooltip shows, with empty parts left out by the renderer. */
export function infoText(info: {
  text: string;
  documentation: string;
  tags: DocTag[];
}): InfoText {
  return {
    signature: info.text,
    documentation: info.documentation.trim(),
    tags: info.tags.map(formatTag),
  };
}

export function renderInfo(info: {
  text: string;
  documentation: string;
  tags: DocTag[];
}): HTMLElement {
  const parts = infoText(info);
  const dom = document.createElement('div');
  dom.className = 'cm-dojo-info';
  const signature = document.createElement('pre');
  signature.className = 'cm-dojo-info-signature';
  signature.textContent = parts.signature;
  dom.append(signature);
  if (parts.documentation !== '') {
    const docs = document.createElement('div');
    docs.className = 'cm-dojo-info-docs';
    docs.textContent = parts.documentation;
    dom.append(docs);
  }
  for (const tag of parts.tags) {
    const line = document.createElement('div');
    line.className = 'cm-dojo-info-tag';
    line.textContent = tag;
    dom.append(line);
  }
  return dom;
}

type QuickInfoClient = Pick<TsLsClient, 'getQuickInfo'>;

function tooltipFor(info: QuickInfoResult, pos: number): Tooltip {
  return {
    pos: info.start,
    end: info.start + info.length,
    above: true,
    create: () => ({ dom: renderInfo(info) }),
    // Keep the tooltip anchored even when the symbol is empty-ranged.
    ...(info.length === 0 ? { pos } : {}),
  };
}

/** Mouse hover. */
export function quickInfoHover(compiler: QuickInfoClient): Extension {
  return hoverTooltip(
    async (view, pos) => {
      const path = view.state.facet(filePath);
      let info: QuickInfoResult | null;
      try {
        info = await compiler.getQuickInfo(path, pos);
      } catch {
        return null;
      }
      return info === null ? null : tooltipFor(info, pos);
    },
    { hoverTime: 250 },
  );
}

const setCursorInfo = StateEffect.define<Tooltip | null>();

/** The `K` tooltip: set by `showQuickInfoAtCursor`, cleared by the next edit or cursor move. */
export const cursorInfoField = StateField.define<Tooltip | null>({
  create: () => null,
  update(value, tr) {
    let next: Tooltip | null = value;
    for (const effect of tr.effects) {
      if (effect.is(setCursorInfo)) next = effect.value;
    }
    if (next === value && (tr.docChanged || tr.selection !== undefined)) {
      return null;
    }
    return next;
  },
  provide: (field) => showTooltip.from(field),
});

/** `:info` (what `K` calls): quick info for the symbol at the cursor, or a notice when there is none. */
export async function showQuickInfoAtCursor(
  view: EditorView,
  compiler: QuickInfoClient,
): Promise<QuickInfoResult | null> {
  const path = view.state.facet(filePath);
  const pos = view.state.selection.main.head;
  let info: QuickInfoResult | null;
  try {
    info = await compiler.getQuickInfo(path, pos);
  } catch {
    return null;
  }
  if (view.state.selection.main.head !== pos) return null;
  view.dispatch({
    effects: setCursorInfo.of(info === null ? null : tooltipFor(info, pos)),
  });
  return info;
}

export const infoTheme = EditorView.baseTheme({
  '.cm-tooltip.cm-dojo-info': {
    maxWidth: '40rem',
    padding: '4px 8px',
    fontSize: '0.9em',
  },
  '.cm-dojo-info-signature': {
    margin: '0',
    fontFamily: 'inherit',
    whiteSpace: 'pre-wrap',
  },
  '.cm-dojo-info-docs': {
    marginTop: '4px',
    whiteSpace: 'pre-wrap',
    fontFamily: 'var(--font-sans)',
    color: 'var(--muted-foreground)',
  },
  '.cm-dojo-info-tag': {
    marginTop: '2px',
    fontFamily: 'var(--font-sans)',
    color: 'var(--muted-foreground)',
  },
});

export function quickInfo(compiler: QuickInfoClient): Extension {
  return [quickInfoHover(compiler), cursorInfoField, infoTheme];
}

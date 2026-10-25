// The settings a store hands out: read-only at every level.
export interface Settings {
  readonly theme: {
    readonly mode: 'light' | 'dark';
    readonly accent: readonly [number, number, number];
  };
  readonly editor: {
    readonly tabSize: number;
    readonly rulers: readonly number[];
    readonly vim: { readonly enabled: boolean; readonly leader: string };
  };
  readonly format: (size: number) => string;
}

// Draft<T>: a copy of T that may be edited.
export type Draft<T> = { -readonly [K in keyof T]: T[K] };

// Edits a draft in place, and returns the new tab size as text.
export function applyEdits(draft: Draft<Settings>): string {
  draft.theme.mode = 'dark';
  draft.theme.accent[0] = 210;
  draft.editor.rulers.push(120);
  draft.editor.vim.enabled = true;
  draft.editor.tabSize = 4;
  return draft.format(draft.editor.tabSize);
}

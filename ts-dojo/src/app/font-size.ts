// The code font size (§7 `fontSize`, F10 Settings): `--code-font-size` on <html>, which the
// editor theme (src/editor/extensions.ts) and the theory blocks (`.shiki` in globals.css) read.
// Applied before the first render, like the theme, and again on every settings write, this tab's
// or another's, so an open editor follows without a reload.
import {
  FONT_SIZE,
  readSettings,
  subscribeSettings,
  type Settings,
} from '@/store/settings';

export const CODE_FONT_SIZE_PROPERTY = '--code-font-size';

export interface FontSizeRoot {
  style: { setProperty(name: string, value: string): void };
}

export interface FontSizeEnv {
  root: FontSizeRoot;
  storage: Pick<Storage, 'getItem'> | null | undefined;
}

export function applyFontSize(root: FontSizeRoot, px: number): void {
  root.style.setProperty(CODE_FONT_SIZE_PROPERTY, `${String(px)}px`);
}

const sizeOf = (settings: Settings): number =>
  settings.fontSize ?? FONT_SIZE.default;

/** Applies the stored size now and on every settings write. Returns the unsubscribe. */
export function initFontSize(
  env: FontSizeEnv = browserFontSizeEnv(),
): () => void {
  applyFontSize(env.root, sizeOf(readSettings(env.storage)));
  return subscribeSettings((settings) => {
    applyFontSize(env.root, sizeOf(settings));
  });
}

function browserFontSizeEnv(): FontSizeEnv {
  let storage: Storage | null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return { root: document.documentElement, storage };
}

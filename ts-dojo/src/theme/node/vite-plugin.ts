// A Vite plugin serving the scheme stylesheet (src/theme/css.ts) as the virtual module
// `virtual:ts-dojo-schemes.css`, which src/main.tsx imports beside globals.css. The palettes
// live in TypeScript (the picker and the theme-color meta read them too), so the CSS is
// generated rather than kept by hand. vite.config.ts loads this through tsx's `tsImport`, like
// the content plugin, so the `@/` alias resolves; a change to a scheme file needs a dev server
// restart, as a content plugin change does.
import type { Plugin } from 'vite';
import { schemesCss } from '../css';

export const SCHEMES_MODULE_ID = 'virtual:ts-dojo-schemes.css';
const RESOLVED_ID = `\0${SCHEMES_MODULE_ID}`;

export function tsDojoSchemes(): Plugin {
  return {
    name: 'ts-dojo-schemes',
    resolveId(id) {
      return id === SCHEMES_MODULE_ID ? RESOLVED_ID : null;
    },
    load(id) {
      return id === RESOLVED_ID ? schemesCss() : null;
    },
  };
}

// ESLint 9 flat config (spec §2 Stack): typescript-eslint with type information over both
// tsconfig projects, react-hooks, jsx-a11y, and eslint-config-prettier last so formatting
// stays Prettier's. The Prep spike and the scripts are linted too. public/ holds copied
// compiler files and .claude/ the Claude Code hooks, which Prettier also leaves alone.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'dist/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'public/**',
    '.claude/**',
  ]),
  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Node-side code: the scripts, the Prep spike's Playwright side, e2e and the config files.
    files: ['scripts/**', 'spike/**', 'e2e/**', '*.config.{ts,js}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  prettier,
]);

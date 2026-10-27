import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', '.playtest/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['server/**', 'shared/**', '*.config.{js,ts}', '.claude/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['client/**'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  prettier,
);

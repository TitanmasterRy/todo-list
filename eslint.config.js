import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
  { ignores: ['dist/', 'dev-dist/', 'dist-extension/', 'node_modules/', 'public/', 'docs/', 'extension/'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node, __CHANGELOG_HEAD__: 'readonly' } },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: ts.parser, extraFileExtensions: ['.svelte'] } },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // {@html} only renders our own escaped markdown (lib/markdown.ts)
      'svelte/no-at-html-tags': 'off',
      // plain hrefs for downloads/external links are fine in a static app
      'svelte/no-navigation-without-resolve': 'off',
      // static lists (days, options, paytables) don't need keys; dynamic lists already have them
      'svelte/require-each-key': 'off',
      // flags local, non-reactive Map/Set/Date temporaries inside functions
      'svelte/prefer-svelte-reactivity': 'off',
      'preserve-caught-error': 'off',
      // placeholder={'line 1\nline 2'} needs the mustache for the escape
      'svelte/no-useless-mustaches': ['error', { ignoreStringEscape: true }],
    },
  },
);

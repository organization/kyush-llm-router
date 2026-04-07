// @ts-check
import eslint from '@eslint/js';
import prettier from 'eslint-plugin-prettier/recommended';
import solid from 'eslint-plugin-solid/configs/recommended';
import stylistic from '@stylistic/eslint-plugin';
import tsEslint from 'typescript-eslint';
import * as importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default tsEslint.config(
  eslint.configs.recommended,
  tsEslint.configs.eslintRecommended,
  ...tsEslint.configs.recommendedTypeChecked,
  prettier,
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/storybook-static/**',
      '**/coverage/**',
      '**/data/**',
      '**/*.config.*js',
      '**/*.test.*js',
      'scripts/**',
      'server/scripts/**',
      'database/**',
      '**/public/**',
      '**/.storybook/**',
      '**/vite.config.*',
      '**/vitest.config.*',
    ],
  },

  // ── Common rules for TS/TSX across the monorepo ──
  {
    files: ['**/*.{ts,tsx,mts}'],
    plugins: {
      '@stylistic': stylistic,
      import: importPlugin,
    },
    languageOptions: {
      parser: tsEslint.parser,
      parserOptions: {
        project: ['./server/tsconfig.eslint.json', './client/tsconfig.json'],
        sourceType: 'module',
        ecmaVersion: 'latest',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Stylistic rules from the youtube-music reference config
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/quotes': [
        'error',
        'single',
        { avoidEscape: true, allowTemplateLiterals: false },
      ],
      '@stylistic/quote-props': ['error', 'consistent'],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/no-mixed-operators': 'warn',
      '@stylistic/no-multi-spaces': ['error', { ignoreEOLComments: true }],
      '@stylistic/no-tabs': 'error',
      '@stylistic/lines-around-comment': [
        'error',
        {
          beforeBlockComment: false,
          afterBlockComment: false,
          beforeLineComment: false,
          afterLineComment: false,
        },
      ],
      '@stylistic/max-len': 'off',

      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          semi: true,
          tabWidth: 2,
          trailingComma: 'all',
          quoteProps: 'preserve',
        },
      ],

      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-duplicate-type-constituents': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/only-throw-error': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/dot-notation': 'off',
      'no-void': 'off',
      'no-useless-escape': 'off',
      'no-prototype-builtins': 'off',
      'prefer-const': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
          prefer: 'type-imports',
          disallowTypeAnnotations: false,
        },
      ],

      'import/first': 'error',
      'import/newline-after-import': 'off',
      'import/no-default-export': 'off',
      'import/no-duplicates': 'error',
      'import/no-unresolved': [
        'error',
        {
          ignore: ['^virtual:', '\\?inline$', '\\?raw$', '\\?asset&asarUnpack'],
        },
      ],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', ['internal', 'index', 'sibling'], 'parent', 'type'],
          'newlines-between': 'always-and-inside-groups',
          alphabetize: { order: 'ignore', caseInsensitive: false },
        },
      ],
      'import/prefer-default-export': 'off',

      camelcase: 'off',
      'class-methods-use-this': 'off',
      'no-empty': 'off',
      'prefer-promise-reject-errors': 'off',
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          project: ['server/tsconfig.eslint.json', 'client/tsconfig.json'],
        },
      },
    },
  },

  // ── Client-only (Solid.js + JSX) ──
  {
    files: ['client/**/*.{ts,tsx}'],
    ...solid,
    languageOptions: {
      ...solid.languageOptions,
      globals: { ...globals.browser },
      parser: tsEslint.parser,
      parserOptions: {
        project: ['./client/tsconfig.json'],
        sourceType: 'module',
        ecmaVersion: 'latest',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...solid.rules,
      '@stylistic/jsx-pascal-case': 'error',
      '@stylistic/jsx-curly-spacing': ['error', { when: 'never', children: true }],
      '@stylistic/jsx-sort-props': 'error',
    },
  },

  // ── Server-only (Node) ──
  {
    files: ['server/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // ── Shared types (loose - it's just type definitions) ──
  {
    files: ['shared/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
);

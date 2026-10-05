import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const DOM_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'requestAnimationFrame',
  'performance',
  'AudioContext',
  'HTMLElement',
  'HTMLCanvasElement',
];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', '.claude'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // The simulation must stay pure and deterministic: no DOM, no wall clock, no Math.random.
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...DOM_GLOBALS],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded PRNG from src/engine/prng.ts.',
        },
        { object: 'Date', property: 'now', message: 'Simulation time comes from ticks.' },
      ],
    },
  },
  prettier,
);

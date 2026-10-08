import globals from 'globals';

export default [
  { ignores: ['dist/', 'site/', 'test-results/', 'playwright-report/'] },
  {
    files: ['src/**/*.js', 'tools/shared/**/*.js', 'tools/site/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser, __TINY_TELLS_VERSION__: 'readonly', __FA_VERSION__: 'readonly' },
    },
    rules: { 'no-undef': 'error', 'no-unused-vars': 'error' },
  },
  {
    files: ['tools/**/*.mjs', 'tests/**/*.mjs', '*.config.js', 'tests/tiny-tell.spec.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-undef': 'error', 'no-unused-vars': 'error' },
  },
];

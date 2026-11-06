// Lints the whole repo with Expo's official config, adjusted per folder:
// the Expo app (React Native), functions/ (Node, CommonJS) and web/ (plain
// browser ES modules that load Firebase from Google's CDN).
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['**/*.test.js'],
    languageOptions: { globals: globals.jest },
  },
  {
    files: ['scripts/**/*.js', 'tests/**/*.{mjs,cjs}', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['functions/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    files: ['web/**/*.js'],
    languageOptions: { sourceType: 'module', globals: globals.browser },
    rules: {
      // The Firebase SDK is imported from https://www.gstatic.com URLs and
      // firebase-config.js is generated per project (gitignored), so the
      // import resolver can't follow them.
      'import/no-unresolved': ['error', { ignore: ['^https://', String.raw`^\./firebase-config\.js$`] }],
    },
  },
]);

// Lints the Expo app. functions/ (Node) and web/ (plain browser ES
// modules loading Firebase from a CDN) run in different environments, so
// they're excluded here rather than linted with the React Native rules.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'functions/*', 'web/*'],
  },
  {
    files: ['**/*.test.js'],
    languageOptions: { globals: globals.jest },
  },
  {
    files: ['scripts/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
]);

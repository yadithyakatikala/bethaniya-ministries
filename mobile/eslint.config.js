// ESLint flat config for the mobile app.
// Base rules come from eslint-config-expo; Prettier integration disables any
// stylistic ESLint rules that would conflict with Prettier's own formatting.
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*'],
  },
  {
    // Jest manual mocks (__mocks__/) and the Jest setup file use the global
    // `jest` object outside of any *.test.* file, so eslint-config-expo's
    // test-file glob (which supplies Jest globals) doesn't cover them.
    files: ['jest.setup.js', '**/__mocks__/**/*.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
      },
    },
  },
];

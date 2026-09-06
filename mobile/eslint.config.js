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
];

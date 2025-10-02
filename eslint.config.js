const globals = require('globals');
const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');
const vue = require('eslint-plugin-vue');

module.exports = [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none' }],
    },
  },
  // Add the Vue plugin configuration
  ...vue.configs['flat/recommended'],
  {
    // Specify browser globals for .vue files
    files: ['mini-app/**/*.vue'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    // Configuration for the Vue Mini App JS files
    files: ['mini-app/**/*.js'], // .vue files are now handled by the plugin
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
  },
];
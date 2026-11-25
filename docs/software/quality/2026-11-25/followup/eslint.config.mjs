import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';

export default [{ ignores: ['**/*.d.ts'] }, {
  files: ['**/*.ts', '**/*.tsx'],

  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  },
  plugins: { '@typescript-eslint': tseslint.plugin, sonarjs },
  rules: {
    'no-constant-condition': 'error',
    'no-constant-binary-expression': 'error',
    'no-unreachable': 'error',
    'no-unsafe-finally': 'error',
    'no-dupe-args': 'error',
    'no-dupe-else-if': 'error',
    'valid-typeof': 'error',
    'for-direction': 'error',
    '@typescript-eslint/no-unused-vars': ['warn', {
      args: 'after-used', caughtErrors: 'none', argsIgnorePattern: '^_', varsIgnorePattern: '^_'
    }],
    'complexity': ['warn', 10],
    'max-depth': ['warn', 4],
    'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
    'sonarjs/cognitive-complexity': ['warn', 15],
    'sonarjs/no-identical-expressions': 'error',
  },
}];
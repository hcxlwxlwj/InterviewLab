import base from './eslint.config.mjs';
export default [...base, {
  files: ['**/*.ts', '**/*.tsx'],
  rules: {
    'max-lines-per-function': ['warn', {max: 40, skipBlankLines: true, skipComments: true}],
    'max-depth': ['warn', 3],
    'max-params': ['warn', 4],
    'max-lines': ['warn', {max: 400, skipBlankLines: false, skipComments: false}],
  },
}];

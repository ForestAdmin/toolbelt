module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts'],
      },
    },
    node: {
      tryExtensions: ['.js', '.json', '.node', '.ts'],
    },
  },
  extends: [
    'airbnb-base',
    'plugin:sonarjs/recommended',
    'plugin:jest/all',
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'prettier',
  ],
  plugins: ['sonarjs', '@typescript-eslint', 'prettier'],
  env: {
    node: true,
  },
  ignorePatterns: ['expected'],
  rules: {
    'jest/valid-describe': 0, // This rule does not exist anymore. It has been replaced by jest/valid-describe-callback
    'jest/require-hook': 0, // This rule does not seem to be functional at this time (eslint-plugin-jest-25.2.2)
    'jest/no-disabled-tests': 0,
    'implicit-arrow-linebreak': 0,
    'no-underscore-dangle': 0,
    'import/extensions': 0,
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['.eslint-bin/*.js', 'test/**/*.js'],
      },
    ],
    'no-multiple-empty-lines': [
      'error',
      {
        max: 1,
        maxBOF: 0,
        maxEOF: 0,
      },
    ],
    'no-console': 0,
    'no-param-reassign': 0,
    'jest/expect-expect': 0,
    'sonarjs/no-collapsible-if': 0,
    'sonarjs/no-duplicate-string': 0,
    'sonarjs/no-extra-arguments': 0,
    'sonarjs/no-identical-expressions': 0,
    'sonarjs/no-identical-functions': 0,
    'sonarjs/no-same-line-conditional': 0,
    'sonarjs/no-unused-collection': 0,
    'sonarjs/prefer-immediate-return': 0,
  },
  overrides: [
    {
      files: ['*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      files: ['test/**'],
      rules: {
        '@typescript-eslint/no-empty-function': 'off',
      },
    },
  ],
};

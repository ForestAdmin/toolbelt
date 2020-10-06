module.exports = {
  root: true,
  extends: [
    'airbnb-base',
    'plugin:sonarjs/recommended',
    'plugin:jest/all',
  ],
  plugins: [
    'sonarjs',
  ],
  env: {
    node: true,
  },
  rules: {
    'implicit-arrow-linebreak': 0,
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          'test/**/*.js',
        ]
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
};

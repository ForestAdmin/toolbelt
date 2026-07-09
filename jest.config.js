const appRoot = require('app-root-path');

module.exports = {
  coverageReporters: [
    [
      'lcov',
      {
        // Prevents unwanted sketchy `../../` prefix in lcov report.
        // This lead to error when sharing coverage with CodeClimate.
        projectRoot: appRoot.path,
      },
    ],
  ],

  collectCoverageFrom: ['**/*.{js,ts,tsx}'],

  coveragePathIgnorePatterns: [
    '/coverage',
    '/.eslint-bin/',
    '/node_modules/',
    '/test/',
    '/test-.*',
    '/.*.config.js',
    '/.*rc.js',
    '/.dependency-cruiser.js',
  ],

  transform: {
    '^.+\\.(j|t)s$': '@swc/jest',
  },

  // bpmn-moddle (used in tests to verify editor importability) and its
  // dependency chain are published as ESM only — transpile them too.
  transformIgnorePatterns: ['/node_modules/(?!(bpmn-moddle|moddle|moddle-xml|min-dash|saxen)/)'],

  testEnvironment: 'node',
};

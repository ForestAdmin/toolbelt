const appRoot = require('app-root-path');

module.exports = {
  preset: 'ts-jest',
  coverageReporters: [
    [
      'lcov',
      {
        // Prevents unwanted sketchy `../../` prefix in lcov report.
        // This lead to error when sharing coverage with CodeClimate.
        projectRoot: appRoot.path,
      }],
  ],

  collectCoverageFrom: [
    '**/*.{js,ts,tsx}',
  ],

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

  testEnvironment: 'node',
};

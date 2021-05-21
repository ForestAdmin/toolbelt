module.exports = {
  coverageReporters: [
    [
      'lcov',
      {
        // Prevents unwanted sketchy `../../` prefix in lcov report.
        // This lead to error when sharing coverage with CodeClimate.
        projectRoot: process.cwd(),
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
  ],

  testEnvironment: 'node',
};

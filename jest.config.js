module.exports = {
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

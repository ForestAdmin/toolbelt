module.exports = {
  testEnv: {
    FOREST_URL: 'http://localhost:3001',
    TOKEN_PATH: './test/services/tokens',
  },
  testEnv2: {
    FOREST_URL: 'http://localhost:3001',
    TOKEN_PATH: './test/services/tokens',
    FOREST_ENV_SECRET: 'forestEnvSecret',
  },
};

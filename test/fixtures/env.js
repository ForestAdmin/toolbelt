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
  testEnvWithDatabaseUrl: {
    FOREST_URL: 'http://localhost:3001',
    TOKEN_PATH: './test/services/tokens',
    FOREST_ENV_SECRET: 'forestEnvSecret',
    DATABASE_URL: 'postgres://some:cred@localhost:5435/ma-db',
  },
};

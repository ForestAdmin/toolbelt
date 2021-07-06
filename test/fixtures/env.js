module.exports = {
  testEnvWithoutSecret: {
    FOREST_URL: 'http://localhost:3001',
  },
  testEnvWithSecret: {
    FOREST_URL: 'http://localhost:3001',
    FOREST_ENV_SECRET: 'forestEnvSecret',
  },
  testEnvWithSecretAndDatabaseURL: {
    FOREST_URL: 'http://localhost:3001',
    FOREST_ENV_SECRET: 'forestEnvSecret',
    DATABASE_URL: 'postgres://some:cred@localhost:5435/ma-db',
  },
};

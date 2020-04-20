module.exports = {
  mockEnv: (env) => {
    if (env) {
      process.previousEnv = process.env;
      process.env = env;
    }
  },
  rollbackEnv: (env) => {
    if (env) {
      process.env = process.previousEnv;
      process.previousEnv = null;
    }
  },
};

const context = require('@forestadmin/context');

const { env: injectedEnv } = context.inject();

function copyValuesInSameReference(source, destination) {
// We need to keep the same reference
  Object.keys(destination).forEach((name) => {
    delete destination[name];
  });

  Object.entries(source).forEach(([name, value]) => {
    destination[name] = value;
  });
}

module.exports = {
  mockEnv: (env) => {
    if (env) {
      process.previousEnv = { ...process.env };
      copyValuesInSameReference(env, process.env);
      copyValuesInSameReference(env, injectedEnv);
    }
  },
  rollbackEnv: (env) => {
    if (env) {
      copyValuesInSameReference(process.previousEnv, process.env);
      copyValuesInSameReference(process.previousEnv, injectedEnv);
      process.previousEnv = null;
    }
  },
};

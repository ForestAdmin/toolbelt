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
  mockEnv: (env, context) => {
    if (env) {
      process.previousEnv = { ...process.env };
      copyValuesInSameReference(env, process.env);
      copyValuesInSameReference(env, context.env);
    }
  },
  rollbackEnv: (env, context) => {
    if (env) {
      copyValuesInSameReference(process.previousEnv, process.env);
      copyValuesInSameReference(process.previousEnv, context.env);
      process.previousEnv = null;
    }
  },
};

module.exports = (plan) => plan
  .addStep('exit', (context) => context
    .addFunction('exitProcess', (exitCode) => process.exit(exitCode)));

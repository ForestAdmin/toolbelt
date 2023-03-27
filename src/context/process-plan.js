module.exports = plan =>
  plan.addPackage('exit', context =>
    context.addFunction('exitProcess', exitCode => process.exit(exitCode)),
  );

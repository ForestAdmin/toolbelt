function mockDependencies(contextPlan) {
  contextPlan
    .step('dependencies')
    .replace(
      'open',
      (context) => context.addFunction('open', jest.fn()),
    );
}

module.exports = { mockDependencies };
